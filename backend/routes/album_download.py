from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from supabase import create_client
import os
from dotenv import load_dotenv
import httpx
import io
import zipfile
import asyncio
import logging
from datetime import datetime
import traceback
from zipstream import ZipStream, ZIP_DEFLATED


load_dotenv()

# Configurar logging em arquivo
LOG_DIR = "/tmp"  # Railway escreve em /tmp
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

LOG_FILE = os.path.join(LOG_DIR, "album_download.log")
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)
logger.info("=== Album Download Service Iniciado ===")

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
            logger.info(f"✅ {filename} ({len(response.content)//1024}KB)")
            return (filename, response.content)
    except Exception as e:
        logger.error(f"❌ {title}: {str(e)[:30]}")
    
    return None


async def stream_zip(songs, album_title):
    """
    Gera ZIP com streaming IMEDIATO usando zipstream-ng.
    Download começa imediatamente conforme as músicas são baixadas.
    """
    logger.info(f"Iniciando download PARALELO de {len(songs)} músicas")
    
    # Baixar todas as músicas em paralelo
    async with httpx.AsyncClient(timeout=60.0, limits=httpx.Limits(max_connections=10)) as client:
        tasks = [download_single_song(client, song, idx) for idx, song in enumerate(songs, 1)]
        results = await asyncio.gather(*tasks)

    downloaded_files = [r for r in results if r is not None]
    logger.info(f"Total baixado: {len(downloaded_files)} músicas")

    if not downloaded_files:
        logger.error("Nenhuma música baixada!")
        yield b"Erro: Nenhuma musica encontrada"
        return

    logger.info(f"✅ Criando ZIP com {len(downloaded_files)} arquivos usando ZipStream...")
    
    try:
        # Criar ZipStream
        zs = ZipStream(compress_type=ZIP_DEFLATED, compress_level=6)
        
        # Adicionar arquivos ao ZIP
        for filename, content in downloaded_files:
            logger.info(f"Adicionando {filename} ao ZIP ({len(content)//1024}KB)")
            zs.add(content, filename)
        
        logger.info(f"✅ Iniciando stream do ZIP...")
        
        # Stream dos dados
        chunk_count = 0
        total_bytes = 0
        
        for chunk in zs:
            chunk_count += 1
            total_bytes += len(chunk)
            if chunk_count == 1:
                logger.info(f"✅ Primeiro chunk enviado (streaming ativo) - {len(chunk)} bytes")
            yield chunk
        
        logger.info(f"✅ Streaming completo: {chunk_count} chunks, {total_bytes//1024}KB")
        
    except Exception as e:
        logger.error(f"❌ Erro ao criar ZIP: {str(e)}")
        logger.error(traceback.format_exc())
        raise


@router.get("/{album_id}/download")
async def download_album(album_id: str):
    """
    Retorna um arquivo ZIP em stream contendo todas as musicas de um album.
    Streams chunks conforme as musicas sao baixadas (melhor para mobile).
    """
    try:
        logger.info(f"Iniciando download do album: {album_id}")
        
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
        
        logger.info(f"Album '{album_title}' tem {len(songs)} musicas - iniciando stream...")
        
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
        logger.error(f"Erro: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao gerar download do album: {str(e)}"
        )


@router.get("/debug/logs")
async def get_logs():
    """Retorna o conteúdo do arquivo de log."""
    try:
        with open(LOG_FILE, 'r') as f:
            logs = f.read()
        return {"log_file": LOG_FILE, "logs": logs}
    except FileNotFoundError:
        return {"error": f"Log file not found: {LOG_FILE}"}
    except Exception as e:
        return {"error": str(e)}
