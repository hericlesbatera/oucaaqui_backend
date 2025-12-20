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
    Gera ZIP com streaming IMEDIATO - começa download enquanto baixa as músicas.
    """
    import threading
    import queue
    
    logger.info(f"Iniciando download PARALELO de {len(songs)} músicas")
    
    # Fila para comunicação entre threads
    file_queue = queue.Queue()
    download_done = threading.Event()
    
    # Função que baixa as músicas (roda em thread separada)
    async def download_all_songs():
        async with httpx.AsyncClient(timeout=60.0, limits=httpx.Limits(max_connections=10)) as client:
            tasks = [download_single_song(client, song, idx) for idx, song in enumerate(songs, 1)]
            results = await asyncio.gather(*tasks)
        
        downloaded_files = [r for r in results if r is not None]
        logger.info(f"Total baixado: {len(downloaded_files)} músicas")
        
        for file_data in downloaded_files:
            file_queue.put(file_data)
        
        file_queue.put(None)  # Sinalizador de fim
        download_done.set()
    
    # Função que cria o ZIP enquanto recebe arquivos (em thread separada)
    def create_zip():
        zip_buffer = io.BytesIO()
        zf = zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED)
        files_added = 0
        
        try:
            while True:
                file_data = file_queue.get()
                
                if file_data is None:  # Fim dos downloads
                    break
                
                filename, content = file_data
                zf.writestr(filename, content)
                files_added += 1
                logger.info(f"Arquivo {files_added} adicionado ao ZIP: {filename}")
            
            zf.close()
            logger.info(f"✅ ZIP finalizado com {files_added} arquivos")
            
            # Sinalizar que ZIP está pronto
            file_queue.put(("__ZIP_READY__", zip_buffer))
        except Exception as e:
            logger.error(f"Erro ao criar ZIP: {str(e)}")
            file_queue.put(("__ZIP_ERROR__", str(e)))
    
    # Iniciar threads
    try:
        # Thread para baixar
        download_thread = threading.Thread(target=lambda: asyncio.run(download_all_songs()), daemon=True)
        download_thread.start()
        
        # Thread para criar ZIP
        zip_thread = threading.Thread(target=create_zip, daemon=True)
        zip_thread.start()
        
        # Aguardar ZIP pronto
        while True:
            item = file_queue.get()
            if isinstance(item, tuple) and len(item) == 2:
                status, data = item
                if status == "__ZIP_READY__":
                    zip_buffer = data
                    break
                elif status == "__ZIP_ERROR__":
                    raise Exception(data)
        
        logger.info(f"✅ Iniciando stream do ZIP...")
        
        # Stream do ZIP em chunks
        zip_buffer.seek(0)
        chunk_size = 262144  # 256KB chunks
        chunk_count = 0
        total_bytes = 0
        
        while True:
            chunk = zip_buffer.read(chunk_size)
            if not chunk:
                break
            chunk_count += 1
            total_bytes += len(chunk)
            if chunk_count == 1:
                logger.info(f"✅ Primeiro chunk enviado (streaming ativo)")
            yield chunk
        
        logger.info(f"✅ Streaming completo: {chunk_count} chunks, {total_bytes//1024}KB")
        
    except Exception as e:
        logger.error(f"❌ Erro: {str(e)}")
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
