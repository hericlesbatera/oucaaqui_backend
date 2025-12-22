#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para gerar archives ZIP para albuns
Simples e eficiente
"""
import os
import io
import sys
import zipfile
import httpx
from datetime import datetime
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_albums_without_archive():
    try:
        response = supabase.table('albums').select('*').or_('archive_url.is.null,archive_url.eq.""').execute()
        return response.data if response.data else []
    except Exception as e:
        print(f"Erro ao buscar albuns: {str(e)}")
        return []

def get_album_songs(album_id):
    try:
        response = supabase.table('songs').select('id, title, audio_url, file_url, url, track_number').eq('album_id', album_id).order('track_number', desc=False).execute()
        return response.data if response.data else []
    except Exception as e:
        print(f"Erro ao buscar musicas: {str(e)}")
        return []

def create_album_zip(album_id, album_title, songs):
    if not songs:
        return None
    
    try:
        zip_buffer = io.BytesIO()
        
        # Usar ZIP_STORED (sem compressão) para ser mais rápido
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_STORED) as zip_file:
            with httpx.Client(timeout=60.0) as client:
                for idx, song in enumerate(songs, 1):
                    try:
                        # Tentar múltiplas URLs (file_url é a preferida, depois audio_url, depois url)
                        song_url = song.get('file_url') or song.get('audio_url') or song.get('url')
                        
                        if song_url:
                            # Se a URL é relativa, construir a URL completa do Supabase Storage
                            if not song_url.startswith("http"):
                                song_url = f"{SUPABASE_URL}/storage/v1/object/public/{song_url}"
                            
                            title = song.get('title', f'track_{idx}')[:40]
                            print(f"    Baixando: {title}", end=' ... ', flush=True)
                            response = client.get(song_url, follow_redirects=True)
                            if response.status_code == 200:
                                track_num = song.get('track_number', 0)
                                filename = f"{track_num:02d} - {song.get('title', 'track')}.mp3"
                                zip_file.writestr(filename, response.content)
                                size_kb = len(response.content) // 1024
                                print(f"[OK - {size_kb}KB]")
                            else:
                                print(f"[{response.status_code}]")
                        else:
                            title = song.get('title', f'track_{idx}')[:40]
                            print(f"    {title}", end=' ... ', flush=True)
                            print("[SEM URL]")
                    except httpx.TimeoutException:
                        print("[TIMEOUT]")
                    except Exception as e:
                        print(f"[ERRO: {str(e)[:20]}]")
        
        zip_buffer.seek(0)
        return zip_buffer.getvalue()
    
    except Exception as e:
        print(f"Erro ao criar ZIP: {str(e)}")
        return None

def upload_archive_to_storage(album_id, album_title, zip_content):
    try:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        file_path = f"albums/{album_id}/{album_title}_{timestamp}.zip"
        
        size_mb = len(zip_content) / 1024 / 1024
        print(f"    Upload ({size_mb:.1f}MB)", end=' ... ', flush=True)
        
        # Upload direto
        supabase.storage.from_('musica').upload(file_path, zip_content)
        
        # Obter URL publica
        public_url = supabase.storage.from_('musica').get_public_url(file_path)
        url = public_url.get('publicUrl') if public_url else None
        
        print("[OK]")
        return url
    
    except Exception as e:
        print(f"[ERRO: {str(e)[:40]}]")
        return None

def update_album_archive_url(album_id, archive_url):
    try:
        print(f"    Atualizando BD", end=' ... ', flush=True)
        supabase.table('albums').update({'archive_url': archive_url}).eq('id', album_id).execute()
        print("[OK]")
        return True
    except Exception as e:
        print(f"[ERRO]")
        return False

def main():
    print("[*] Gerando Archives para Albuns")
    print("=" * 60)
    
    albums = get_albums_without_archive()
    print(f"Encontrados {len(albums)} albuns\n")
    
    if not albums:
        return
    
    success_count = 0
    
    for i, album in enumerate(albums, 1):
        album_id = album['id']
        album_title = album.get('title', f'album_{album_id}')[:50].replace('/', '_').replace('\\', '_')
        
        print(f"[{i}/{len(albums)}] {album_title}")
        
        songs = get_album_songs(album_id)
        print(f"  Musicas: {len(songs)}")
        
        if songs:
            print(f"  Criando ZIP...")
            zip_content = create_album_zip(album_id, album_title, songs)
            
            if zip_content:
                archive_url = upload_archive_to_storage(album_id, album_title, zip_content)
                
                if archive_url:
                    if update_album_archive_url(album_id, archive_url):
                        success_count += 1
        print()
    
    print("=" * 60)
    print(f"Concluido: {success_count}/{len(albums)} albuns")

if __name__ == '__main__':
    main()
