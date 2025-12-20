from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from supabase import create_client
import os
from dotenv import load_dotenv
import httpx
import io
import zipfile
import asyncio
try:
    from zipstream import ZipStream
    HAS_ZIPSTREAM = True
except ImportError:
    HAS_ZIPSTREAM = False
    print("WARNING: zipstream not installed, using fallback method")

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

router = APIRouter(prefix="/api/albums", tags=["album_download"])


async def download_single_song(client, song, idx):
    """Baixa uma única música e retorna os dados."""
    audio_url = song.get('audio_url')
    title = song.get('title', f'track_{idx}')[:50]
    
    if not audio_url:
        return None
    
    try:
        response = await client.get(audio_url, follow_redirects=True)
        
        if response.status_code == 200 and len(response.content) > 1000:
            track_num = song.get('track_number') or idx
            safe_title = "".join(c for c in title if c.isalnum() or c in ' -_').strip()
            filename = f"{track_num:02d} - {safe_title}.mp3"
            print(f"[ALBUM_DOWNLOAD] ✅ {filename} ({len(response.content)//1024}KB)")
            return (filename, response.content)
    except Exception as e:
        print(f"[ALBUM_DOWNLOAD] ❌ {title}: {str(e)[:30]}")
    
    return None


async def stream_zip(songs, album_title):
    """
    Gera um ZIP baixando músicas em PARALELO (muito mais rápido).
    """
    print(f"[ALBUM_DOWNLOAD] Iniciando download PARALELO de {len(songs)} músicas")
    print(f"[ALBUM_DOWNLOAD] Baixando músicas do álbum '{album_title}'...")
    async with httpx.AsyncClient(timeout=60.0, limits=httpx.Limits(max_connections=10)) as client:
        tasks = [download_single_song(client, song, idx) for idx, song in enumerate(songs, 1)]
        results = await asyncio.gather(*tasks)

    downloaded_files = [r for r in results if r is not None]
    print(f"[ALBUM_DOWNLOAD] Arquivos baixados: {[f[0] for f in downloaded_files]}")
    print(f"[ALBUM_DOWNLOAD] Total de arquivos baixados: {len(downloaded_files)}")

    if not downloaded_files:
        print("[ALBUM_DOWNLOAD] ❌ Nenhuma música baixada!")
        yield b"Erro: Nenhuma musica encontrada"
        return

    print(f"[ALBUM_DOWNLOAD] ✅ {len(downloaded_files)} músicas baixadas, criando ZIP...")
    file_dict = {filename: content for filename, content in downloaded_files}
    print(f"[ALBUM_DOWNLOAD] Using ZipStream for true streaming (forçado)")
    zs = ZipStream(file_dict, compression=zipfile.ZIP_DEFLATED, chunksize=262144)
    chunk_count = 0
    for chunk in zs:
        chunk_count += 1
        if chunk_count == 1:
            print(f"[ALBUM_DOWNLOAD] Primeiro chunk do ZIP enviado.")
        yield chunk
    print(f"[ALBUM_DOWNLOAD] Fim do streaming ZIP. Total de chunks enviados: {chunk_count}")


@router.get("/{album_id}/download")
async def download_album(album_id: str):
    """
    Retorna um arquivo ZIP em stream contendo todas as musicas de um album.
    Streams chunks conforme as musicas sao baixadas (melhor para mobile).
    """
    try:
        print(f"[ALBUM_DOWNLOAD] Iniciando download do album: {album_id}")
        
        # Buscar album
        album_result = supabase.table("albums").select("id, title").eq("id", album_id).single().execute()
        
        if not album_result.data:
            raise HTTPException(status_code=404, detail="Album nao encontrado")
        
        album = album_result.data
        album_title = album.get("title", f"album_{album_id}")
        
        # Buscar todas as musicas do album
        songs_result = supabase.table("songs").select("id, title, audio_url, track_number").eq("album_id", album_id).order("track_number", desc=False).execute()
        
        songs = songs_result.data if songs_result.data else []
        
        if not songs:
            raise HTTPException(status_code=404, detail="Album nao tem musicas")
        
        print(f"[ALBUM_DOWNLOAD] Album '{album_title}' tem {len(songs)} musicas - iniciando stream...")
        
        # Retornar stream do ZIP
        return StreamingResponse(
            stream_zip(songs, album_title),
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="{album_title}.zip"',
                "Transfer-Encoding": "chunked"
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ALBUM_DOWNLOAD] Erro: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao gerar download do album: {str(e)}"
        )
