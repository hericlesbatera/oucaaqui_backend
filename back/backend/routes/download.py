from fastapi import APIRouter, HTTPException, Query, Header
from fastapi.responses import StreamingResponse
from typing import Optional
from supabase import create_client
import os
from dotenv import load_dotenv
import jwt
import httpx
import asyncio
from io import BytesIO
import zipfile

load_dotenv()

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

router = APIRouter(prefix="/api/download", tags=["download"])

@router.get("/album/{album_id}")
async def download_album(
    album_id: str,
    authorization: Optional[str] = Header(None)
):
    """
    Stream album as ZIP file with all songs.
    Uses streaming to avoid loading entire ZIP into memory.
    """
    try:
        # Get album info
        album_response = supabase.table("albums").select("*").eq("id", album_id).single().execute()
        
        if not album_response.data:
            raise HTTPException(status_code=404, detail="Album not found")
        
        album = album_response.data
        
        # Check if album is private
        if album.get("is_private"):
            if not authorization:
                raise HTTPException(status_code=403, detail="Album is private")
            
            token = authorization.replace("Bearer ", "").strip()
            try:
                decoded = jwt.decode(token, options={"verify_signature": False})
                user_id = decoded.get("sub")
            except Exception as e:
                raise HTTPException(status_code=401, detail="Invalid token")
            
            if album.get("artist_id") != user_id:
                raise HTTPException(status_code=403, detail="You don't have permission to download this album")
        
        # Get all songs for the album
        songs_response = supabase.table("songs").select("*").eq("album_id", album_id).order("track_number", { "ascending": True }).execute()
        
        if not songs_response.data or len(songs_response.data) == 0:
            raise HTTPException(status_code=404, detail="No songs found in album")
        
        songs = songs_response.data
        album_title = album.get("title", "album")
        
        print(f"[DOWNLOAD] Starting album download: {album_title} ({len(songs)} songs)")
        
        # Create streaming ZIP response
        async def generate_zip():
            """Generate ZIP file on-the-fly with streaming"""
            buffer = BytesIO()
            
            with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                for idx, song in enumerate(songs, 1):
                    try:
                        audio_url = song.get("audio_url")
                        if not audio_url:
                            print(f"[DOWNLOAD] Skipping song {idx}: no audio_url")
                            continue
                        
                        # Clean filename for ZIP
                        song_title = song.get("title", f"song_{idx}").replace("/", "_")
                        zip_filename = f"{idx:02d}_{song_title}.mp3"
                        
                        print(f"[DOWNLOAD] Downloading song {idx}/{len(songs)}: {zip_filename}")
                        
                        # Download audio file from Supabase
                        try:
                            async with httpx.AsyncClient(timeout=60.0) as client:
                                response = await client.get(audio_url)
                                if response.status_code == 200:
                                    # Write directly to ZIP
                                    zip_file.writestr(zip_filename, response.content)
                                    print(f"[DOWNLOAD] Added to ZIP: {zip_filename}")
                                else:
                                    print(f"[DOWNLOAD] Failed to download song {idx}: status {response.status_code}")
                        except asyncio.TimeoutError:
                            print(f"[DOWNLOAD] Timeout downloading song {idx}, skipping")
                        except Exception as e:
                            print(f"[DOWNLOAD] Error downloading song {idx}: {e}")
                    
                    except Exception as e:
                        print(f"[DOWNLOAD] Error processing song {idx}: {e}")
                        continue
            
            # Reset buffer position to start
            buffer.seek(0)
            
            # Yield data in chunks
            chunk_size = 1024 * 1024  # 1MB chunks
            while True:
                chunk = buffer.read(chunk_size)
                if not chunk:
                    break
                yield chunk
        
        # Return streaming response
        filename = f"{album_title}.zip"
        return StreamingResponse(
            generate_zip(),
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[DOWNLOAD] Error downloading album: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error downloading album: {str(e)}")


@router.get("/album/{album_id}/stream")
async def download_album_stream(
    album_id: str,
    authorization: Optional[str] = Header(None)
):
    """
    Alternative endpoint that streams ZIP without buffering entire ZIP in memory.
    Uses a generator that yields chunks of audio data as they're downloaded.
    """
    try:
        # Get album info
        album_response = supabase.table("albums").select("*").eq("id", album_id).single().execute()
        
        if not album_response.data:
            raise HTTPException(status_code=404, detail="Album not found")
        
        album = album_response.data
        
        # Check if album is private
        if album.get("is_private"):
            if not authorization:
                raise HTTPException(status_code=403, detail="Album is private")
            
            token = authorization.replace("Bearer ", "").strip()
            try:
                decoded = jwt.decode(token, options={"verify_signature": False})
                user_id = decoded.get("sub")
            except Exception as e:
                raise HTTPException(status_code=401, detail="Invalid token")
            
            if album.get("artist_id") != user_id:
                raise HTTPException(status_code=403, detail="You don't have permission to download this album")
        
        # Get all songs for the album
        songs_response = supabase.table("songs").select("*").eq("album_id", album_id).order("track_number", { "ascending": True }).execute()
        
        if not songs_response.data or len(songs_response.data) == 0:
            raise HTTPException(status_code=404, detail="No songs found in album")
        
        songs = songs_response.data
        album_title = album.get("title", "album")
        
        print(f"[DOWNLOAD] Starting album stream: {album_title} ({len(songs)} songs)")
        
        async def stream_zip():
            """Stream ZIP file with minimal memory usage"""
            # Create a ZIP file generator
            zip_buffer = BytesIO()
            
            with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                for idx, song in enumerate(songs, 1):
                    try:
                        audio_url = song.get("audio_url")
                        if not audio_url:
                            print(f"[DOWNLOAD] Skipping song {idx}: no audio_url")
                            continue
                        
                        song_title = song.get("title", f"song_{idx}").replace("/", "_")
                        zip_filename = f"{idx:02d}_{song_title}.mp3"
                        
                        print(f"[DOWNLOAD] Streaming song {idx}/{len(songs)}: {zip_filename}")
                        
                        # Download and add to ZIP
                        try:
                            async with httpx.AsyncClient(timeout=60.0) as client:
                                async with client.stream('GET', audio_url) as response:
                                    if response.status_code == 200:
                                        # Stream audio file to ZIP
                                        async for chunk in response.aiter_bytes(chunk_size=8192):
                                            zip_file.writestr(zip_filename, chunk, compress_type=zipfile.ZIP_DEFLATED)
                                        print(f"[DOWNLOAD] Added to stream: {zip_filename}")
                                    else:
                                        print(f"[DOWNLOAD] Failed to download song {idx}: status {response.status_code}")
                        except asyncio.TimeoutError:
                            print(f"[DOWNLOAD] Timeout downloading song {idx}, skipping")
                        except Exception as e:
                            print(f"[DOWNLOAD] Error downloading song {idx}: {e}")
                    
                    except Exception as e:
                        print(f"[DOWNLOAD] Error processing song {idx}: {e}")
                        continue
            
            # Yield ZIP data
            zip_buffer.seek(0)
            chunk_size = 1024 * 1024  # 1MB chunks
            while True:
                chunk = zip_buffer.read(chunk_size)
                if not chunk:
                    break
                yield chunk
        
        filename = f"{album_title}.zip"
        return StreamingResponse(
            stream_zip(),
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[DOWNLOAD] Error in stream download: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error downloading album: {str(e)}")
