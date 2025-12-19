from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from supabase import create_client
import os
from dotenv import load_dotenv
import httpx
import io
import asyncio
from zipstream import ZipStream

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

router = APIRouter(prefix="/api/albums", tags=["album_download"])


async def stream_zip(songs, album_title):
    """
    Gera um ZIP em stream real usando zipstream.
    Começa a enviar chunks imediatamente enquanto baixa as musicas.
    """
    # Dict com os arquivos que vao fazer parte do ZIP
    files_dict = {}
    
    async with httpx.AsyncClient(timeout=20.0) as client:
        for idx, song in enumerate(songs, 1):
            try:
                if song.get('audio_url'):
                    title = song.get('title', 'track')[:40]
                    print(f"[ALBUM_DOWNLOAD] Baixando musica {idx}/{len(songs)}: {title}")
                    
                    response = await client.get(song['audio_url'], follow_redirects=True)
                    
                    if response.status_code == 200:
                        track_num = song.get('track_number', idx)
                        filename = f"{track_num:02d} - {song.get('title', 'track')}.mp3"
                        files_dict[filename] = response.content
                        print(f"[ALBUM_DOWNLOAD]   OK ({idx}/{len(songs)}): {filename}")
                    else:
                        print(f"[ALBUM_DOWNLOAD]   FALHOU: status {response.status_code}")
            except Exception as e:
                print(f"[ALBUM_DOWNLOAD]   ERRO: {str(e)[:50]}")
            
            await asyncio.sleep(0)
    
    # Gerar ZIP em stream
    zs = ZipStream(files_dict, compression=8)  # 8 = ZIP_DEFLATED
    for chunk in zs:
        yield chunk


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
