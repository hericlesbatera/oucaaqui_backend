#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para verificar quais músicas têm URLs preenchidas
e quais estão sem URL (causando ZIP vazio)
"""
import os
from supabase import create_client
from dotenv import load_dotenv
from collections import defaultdict

load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def check_song_urls():
    print("[*] Verificando URLs das músicas")
    print("=" * 80)
    
    try:
        # Buscar todas as músicas com todos os campos de URL
        response = supabase.table('songs').select('id, title, album_id, file_url, audio_url, url, track_number').execute()
        songs = response.data if response.data else []
        
        print(f"Total de músicas encontradas: {len(songs)}\n")
        
        # Estatísticas
        stats = defaultdict(int)
        songs_without_url = []
        songs_by_album = defaultdict(list)
        
        for song in songs:
            file_url = song.get('file_url')
            audio_url = song.get('audio_url')
            url = song.get('url')
            
            # Verificar qual URL está preenchida
            if file_url:
                stats['file_url'] += 1
            elif audio_url:
                stats['audio_url'] += 1
            elif url:
                stats['url'] += 1
            else:
                stats['nenhuma_url'] += 1
                songs_without_url.append({
                    'id': song['id'],
                    'title': song['title'],
                    'album_id': song['album_id'],
                    'track_number': song['track_number']
                })
            
            # Agrupar por album para análise
            album_id = song['album_id']
            has_url = file_url or audio_url or url
            songs_by_album[album_id].append({
                'id': song['id'],
                'title': song['title'],
                'has_url': has_url
            })
        
        print("ESTATÍSTICAS DE URLs:")
        print("-" * 80)
        print(f"  ✅ Com file_url:    {stats['file_url']:6d}")
        print(f"  ✅ Com audio_url:   {stats['audio_url']:6d}")
        print(f"  ✅ Com url:         {stats['url']:6d}")
        print(f"  ❌ Sem nenhuma URL: {stats['nenhuma_url']:6d}")
        print()
        
        if songs_without_url:
            print(f"MÚSICAS SEM URL ({len(songs_without_url)}):")
            print("-" * 80)
            for song in songs_without_url[:10]:  # Mostrar as 10 primeiras
                print(f"  [{song['track_number']}] {song['title']} (Album: {song['album_id']})")
            if len(songs_without_url) > 10:
                print(f"  ... e mais {len(songs_without_url) - 10}")
            print()
        
        # Análise por álbum
        print("ÁLBUNS COM PROBLEMAS:")
        print("-" * 80)
        albums_with_issues = []
        for album_id, album_songs in songs_by_album.items():
            total = len(album_songs)
            with_url = sum(1 for s in album_songs if s['has_url'])
            without_url = total - with_url
            
            if without_url > 0:
                albums_with_issues.append({
                    'album_id': album_id,
                    'total': total,
                    'with_url': with_url,
                    'without_url': without_url,
                    'percentage': (with_url / total * 100) if total > 0 else 0
                })
        
        if albums_with_issues:
            albums_with_issues.sort(key=lambda x: x['percentage'])
            for album in albums_with_issues[:20]:  # Top 20
                print(f"  Album {album['album_id']}: {album['with_url']}/{album['total']} " +
                      f"({album['percentage']:.1f}%)")
            if len(albums_with_issues) > 20:
                print(f"  ... e mais {len(albums_with_issues) - 20} álbuns")
        else:
            print("  ✅ Todos os álbuns têm URLs completas!")
        
        print()
        print("=" * 80)
        
    except Exception as e:
        print(f"❌ Erro ao verificar: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    check_song_urls()
