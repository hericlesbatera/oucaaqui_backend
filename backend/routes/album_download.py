from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from supabase import create_client
import os
from dotenv import load_dotenv
import httpx
import io
import zipfile

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

router = APIRouter(prefix="/api/albums", tags=["album_download"])


@router.get("/{album_id}/download")
async def download_album(album_id: str):
    """
    Retorna um arquivo ZIP contendo todas as musicas de um album.
    Gera dinamicamente em vez de usar arquivo pre-armazenado.
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
        
        print(f"[ALBUM_DOWNLOAD] Album '{album_title}' tem {len(songs)} musicas")
        
        # Criar ZIP em memoria
        zip_buffer = io.BytesIO()
        downloaded_count = 0
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            async with httpx.AsyncClient() as client:
                for idx, song in enumerate(songs, 1):
                    try:
                        if song.get('audio_url'):
                            title = song.get('title', 'track')[:40]
                            print(f"[ALBUM_DOWNLOAD] Baixando musica {idx}/{len(songs)}: {title}")
                            
                            response = await client.get(song['audio_url'], timeout=20.0, follow_redirects=True)
                            
                            if response.status_code == 200:
                                track_num = song.get('track_number', idx)
                                filename = f"{track_num:02d} - {song.get('title', 'track')}.mp3"
                                zip_file.writestr(filename, response.content)
                                downloaded_count += 1
                                print(f"[ALBUM_DOWNLOAD]   OK ({downloaded_count}/{len(songs)}): {filename}")
                            else:
                                print(f"[ALBUM_DOWNLOAD]   FALHOU: status {response.status_code}")
                    except Exception as e:
                        print(f"[ALBUM_DOWNLOAD]   ERRO: {str(e)[:50]}")
        
        zip_buffer.seek(0)
        content = zip_buffer.getvalue()
        
        print(f"[ALBUM_DOWNLOAD] ZIP criado: {len(content) / 1024 / 1024:.1f}MB ({downloaded_count} musicas)")
        
        # Registrar download será feito pelo frontend com recordAlbumDownload()
        
        # Retornar arquivo ZIP
        return StreamingResponse(
            iter([content]),
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="{album_title}.zip"',
                "Cache-Control": "public, max-age=3600"
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
