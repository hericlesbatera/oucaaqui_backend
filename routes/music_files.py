from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from supabase import create_client
import os
from dotenv import load_dotenv
import httpx

load_dotenv()

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

router = APIRouter(prefix="/music", tags=["music_files"])


@router.get("/{song_id}/file")
async def get_music_file(song_id: str):
    """
    Retorna o arquivo de áudio de uma música.
    Usado para download e reprodução offline.
    """
    try:
        print(f"[MUSIC_FILE] Buscando arquivo para música: {song_id}")
        
        # Buscar informações da música no banco de dados
        song_result = supabase.table("songs").select("*").eq("id", song_id).single().execute()
        
        if not song_result.data:
            print(f"[MUSIC_FILE] Música não encontrada: {song_id}")
            raise HTTPException(status_code=404, detail="Música não encontrada")
        
        song = song_result.data
        print(f"[MUSIC_FILE] Música encontrada: {song.get('title')}")
        
        # Obter URL do arquivo armazenado no Supabase Storage
        file_url = song.get("file_url") or song.get("audio_url") or song.get("url")
        
        if not file_url:
            print(f"[MUSIC_FILE] Nenhuma URL de arquivo encontrada para: {song_id}")
            print(f"[MUSIC_FILE] Campos disponíveis: {list(song.keys())}")
            raise HTTPException(status_code=404, detail="Arquivo da música não encontrado")
        
        # Se a URL é relativa, construir a URL completa do Supabase Storage
        if not file_url.startswith("http"):
            # Arquivo está no Supabase Storage
            file_url = f"{SUPABASE_URL}/storage/v1/object/public/{file_url}"
        
        print(f"[MUSIC_FILE] Fazendo download de: {file_url}")
        
        # Fazer download do arquivo do Supabase Storage
        async with httpx.AsyncClient() as client:
            response = await client.get(file_url, follow_redirects=True, timeout=30.0)
            
            if response.status_code != 200:
                print(f"[MUSIC_FILE] Erro ao buscar arquivo: status {response.status_code}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Erro ao buscar arquivo de música: {response.status_code}"
                )
            
            print(f"[MUSIC_FILE] Arquivo baixado com sucesso: {len(response.content)} bytes")
            
            # Retornar o arquivo como stream
            return StreamingResponse(
                iter([response.content]),
                media_type="audio/mpeg",
                headers={
                    "Content-Disposition": f"attachment; filename={song.get('title', 'music')}.mp3",
                    "Accept-Ranges": "bytes",
                    "Cache-Control": "public, max-age=86400"
                }
            )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"[MUSIC_FILE] Erro ao buscar arquivo de música: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao buscar arquivo de música: {str(e)}"
        )


@router.head("/{song_id}/file")
async def head_music_file(song_id: str):
    """
    Retorna headers do arquivo de áudio sem retornar o conteúdo.
    Útil para verificar disponibilidade e tamanho do arquivo.
    """
    try:
        # Buscar informações da música no banco de dados
        song_result = supabase.table("songs").select("*").eq("id", song_id).single().execute()
        
        if not song_result.data:
            raise HTTPException(status_code=404, detail="Música não encontrada")
        
        song = song_result.data
        
        # Obter URL do arquivo armazenado no Supabase Storage
        if not song.get("file_url"):
            raise HTTPException(status_code=404, detail="Arquivo da música não encontrado")
        
        file_url = song.get("file_url")
        
        # Se a URL é relativa, construir a URL completa do Supabase Storage
        if not file_url.startswith("http"):
            # Arquivo está no Supabase Storage
            file_url = f"{SUPABASE_URL}/storage/v1/object/public/{file_url}"
        
        # Fazer HEAD request para obter headers
        async with httpx.AsyncClient() as client:
            response = await client.head(file_url, follow_redirects=True)
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail="Erro ao verificar arquivo de música"
                )
            
            # Retornar headers da resposta
            return {
                "status": "ok",
                "content_length": response.headers.get("content-length"),
                "content_type": response.headers.get("content-type"),
                "title": song.get("title")
            }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Erro ao verificar arquivo de música: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao verificar arquivo de música: {str(e)}"
        )
