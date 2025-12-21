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
    import time
    
    audio_url = song.get('audio_url')
    title = song.get('title', f'track_{idx}')[:50]
    
    if not audio_url:
        return None
    
    try:
        start_time = time.time()
        response = await client.get(audio_url, follow_redirects=True)
        elapsed = time.time() - start_time
        
        if response.status_code == 200 and len(response.content) > 1000:
            track_num = song.get('track_number') or idx
            safe_title = "".join(c for c in title if c.isalnum() or c in ' -_').strip()
            filename = f"{track_num:02d} - {safe_title}.mp3"
            size_kb = len(response.content)//1024
            speed = size_kb / elapsed if elapsed > 0 else 0
            logger.info(f"✅ {filename} ({size_kb}KB em {elapsed:.1f}s = {speed:.1f}KB/s)")
            return (filename, response.content)
    except Exception as e:
        logger.error(f"❌ {title}: {str(e)[:50]}")
    
    return None


async def stream_zip(songs, album_title):
    """
    Verdadeiro streaming do ZIP - similar ao ZipStream PHP.
    Baixa, compacta e envia simultaneamente.
    Cliente recebe dados imediatamente.
    """
    import time
    
    logger.info(f"=== INICIANDO DOWNLOAD DE {len(songs)} MÚSICAS ===")
    start_total = time.time()
    
    # Baixar SEQUENCIALMENTE mas ENVIAR IMEDIATAMENTE (sem esperar tudo)
    try:
        # Criar ZIP em memória (sem compressão = mais rápido)
        zip_buffer = io.BytesIO()
        zf = zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_STORED)
        
        # Baixar e adicionar ao ZIP sob demanda
        logger.info(f"⏱️  Iniciando download paralelo...")
        start_download = time.time()
        
        async with httpx.AsyncClient(timeout=60.0, limits=httpx.Limits(max_connections=500, max_keepalive_connections=500)) as client:
            # Baixar TODAS as músicas em PARALELO em vez de sequencial
            tasks = [download_single_song(client, song, idx) for idx, song in enumerate(songs, 1)]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            files_added = 0
            for result in results:
                if result and not isinstance(result, Exception):
                    filename, content = result
                    zf.writestr(filename, content)
                    files_added += 1
        
        download_time = time.time() - start_download
        logger.info(f"✅ DOWNLOAD COMPLETO: {files_added} músicas em {download_time:.1f}s ({files_added/download_time:.1f} músicas/s)")
        
        # Fechar o ZIP para completar o arquivo
        zf.close()
        
        # Agora enviar para o cliente em chunks
        zip_size = zip_buffer.tell()
        logger.info(f"✅ ZIP criado: {zip_size//1024}KB com {files_added} arquivos")
        
        zip_buffer.seek(0)
        chunk_count = 0
        sent_bytes = 0
        
        start_send = time.time()
        logger.info(f"⏱️  INICIANDO ENVIO PARA O CLIENTE...")
        
        while True:
            chunk = zip_buffer.read(262144)  # 256KB chunks
            if not chunk:
                break
            
            chunk_count += 1
            sent_bytes += len(chunk)
            
            if chunk_count == 1:
                logger.info(f"✅ PRIMEIRO CHUNK ENVIADO! ({len(chunk)} bytes)")
            
            yield chunk
        
        send_time = time.time() - start_send
        total_time = time.time() - start_total
        logger.info(f"✅ STREAMING COMPLETO em {total_time:.1f}s")
        logger.info(f"   - Download: {download_time:.1f}s")
        logger.info(f"   - Envio: {send_time:.1f}s")
        logger.info(f"   - {chunk_count} chunks, {sent_bytes//1024}KB enviados, {(sent_bytes/1024)/send_time:.1f}KB/s")
        
    except Exception as e:
        logger.error(f"❌ Erro: {str(e)}")
        logger.error(traceback.format_exc())
        raise


@router.get("/{album_id}/download")
async def download_album(album_id: str):
    """
    Retorna um arquivo ZIP contendo todas as musicas de um album.
    Se archive_url existe, faz redirect. Senão, gera em tempo real com streaming.
    """
    try:
        logger.info(f"Iniciando download do album: {album_id}")
        
        # Buscar album
        album_result = supabase.table("albums").select("id, title, archive_url").eq("id", album_id).single().execute()
        
        if not album_result.data:
            raise HTTPException(status_code=404, detail="Album nao encontrado")
        
        album = album_result.data
        album_title = album.get("title", f"album_{album_id}")
        archive_url = album.get("archive_url")
        
        # Se já tem archive pre-gerado, redireciona para ele (instantâneo)
        if archive_url:
            logger.info(f"✅ Usando archive pre-gerado: {archive_url[:50]}...")
            from fastapi.responses import RedirectResponse
            return RedirectResponse(url=archive_url)
        
        # Senão, gera em tempo real
        logger.info(f"⏱️  Archive não existe, gerando em tempo real...")
        
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
