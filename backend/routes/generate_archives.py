from fastapi import APIRouter, HTTPException
from supabase import create_client
import os
from dotenv import load_dotenv
import httpx
import io
import zipfile
from datetime import datetime
import asyncio

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
router = APIRouter(prefix="/api/admin", tags=["admin"])


def get_albums_without_archive():
    try:
        response = supabase.table('albums').select('*').or_('archive_url.is.null,archive_url.eq.""').execute()
        return response.data if response.data else []
    except Exception as e:
        print(f"Erro ao buscar albuns: {str(e)}")
        return []


def get_album_songs(album_id):
    try:
        response = supabase.table('songs').select('id, title, audio_url, track_number').eq('album_id', album_id).order('track_number', desc=False).execute()
        return response.data if response.data else []
    except Exception as e:
        print(f"Erro ao buscar musicas: {str(e)}")
        return []


async def create_album_zip(album_id, album_title, songs):
    if not songs:
        return None
    
    try:
        zip_buffer = io.BytesIO()
        
        # Usar ZIP_STORED (sem compressão) para ser mais rápido
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_STORED) as zip_file:
            async with httpx.AsyncClient(timeout=60.0) as client:
                for idx, song in enumerate(songs, 1):
                    try:
                        if song.get('audio_url'):
                            response = await client.get(song['audio_url'], follow_redirects=True)
                            if response.status_code == 200:
                                track_num = song.get('track_number', 0)
                                filename = f"{track_num:02d} - {song.get('title', 'track')}.mp3"
                                zip_file.writestr(filename, response.content)
                    except asyncio.TimeoutError:
                        pass
                    except Exception:
                        pass
        
        zip_buffer.seek(0)
        return zip_buffer.getvalue()
    
    except Exception as e:
        print(f"Erro ao criar ZIP: {str(e)}")
        return None


def upload_archive_to_storage(album_id, album_title, zip_content):
    try:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        file_path = f"albums/{album_id}/{album_title}_{timestamp}.zip"
        
        # Upload direto
        supabase.storage.from_('musica').upload(file_path, zip_content)
        
        # Obter URL publica
        public_url = supabase.storage.from_('musica').get_public_url(file_path)
        url = public_url.get('publicUrl') if public_url else None
        
        return url
    
    except Exception as e:
        print(f"Erro no upload: {str(e)}")
        return None


def update_album_archive_url(album_id, archive_url):
    try:
        supabase.table('albums').update({'archive_url': archive_url}).eq('id', album_id).execute()
        return True
    except Exception as e:
        print(f"Erro ao atualizar BD: {str(e)}")
        return False


@router.post("/generate-archives")
async def generate_archives():
    """
    Gera ZIPs para todos os álbuns que ainda não têm archive_url.
    Isso pode levar vários minutos dependendo da quantidade de álbuns.
    """
    try:
        albums = get_albums_without_archive()
        
        if not albums:
            return {"status": "ok", "message": "Nenhum álbum sem archive_url", "processed": 0}
        
        results = []
        success_count = 0
        
        for i, album in enumerate(albums, 1):
            album_id = album['id']
            album_title = album.get('title', f'album_{album_id}')[:50].replace('/', '_').replace('\\', '_')
            
            songs = get_album_songs(album_id)
            
            if songs:
                zip_content = await create_album_zip(album_id, album_title, songs)
                
                if zip_content:
                    archive_url = upload_archive_to_storage(album_id, album_title, zip_content)
                    
                    if archive_url:
                        if update_album_archive_url(album_id, archive_url):
                            success_count += 1
                            results.append({
                                "album": album_title,
                                "status": "success",
                                "archive_url": archive_url
                            })
                        else:
                            results.append({
                                "album": album_title,
                                "status": "error",
                                "message": "Erro ao atualizar BD"
                            })
                    else:
                        results.append({
                            "album": album_title,
                            "status": "error",
                            "message": "Erro ao fazer upload"
                        })
                else:
                    results.append({
                        "album": album_title,
                        "status": "error",
                        "message": "Erro ao criar ZIP"
                    })
            else:
                results.append({
                    "album": album_title,
                    "status": "skip",
                    "message": "Nenhuma música"
                })
        
        return {
            "status": "ok",
            "total_processed": len(albums),
            "success": success_count,
            "results": results
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar archives: {str(e)}")
