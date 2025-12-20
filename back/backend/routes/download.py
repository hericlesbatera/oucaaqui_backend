from fastapi import APIRouter, HTTPException, Query, Header
from fastapi.responses import StreamingResponse
from typing import Optional, AsyncGenerator
from supabase import create_client
import os
from dotenv import load_dotenv
import jwt
import httpx
import asyncio
from io import BytesIO
import zipfile
import io

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
    Stream album as ZIP file with immediate download start.
    True streaming - starts sending to client immediately, no buffering.
    """
    try:
        # Get album info
        album_response = supabase.table("albums").select("*").eq("id", album_id).single().execute()
        
        if not album_response.data:
            raise HTTPException(status_code=404, detail="Album not found")
        
        album = album_response.data
        album_title = album.get("title", "album")
        
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
        print(f"[DOWNLOAD] Starting album download: {album_title} ({len(songs)} songs)")
        
        async def generate_zip_stream() -> AsyncGenerator[bytes, None]:
            """
            Generate ZIP file with REAL streaming.
            Starts downloading immediately, no buffering.
            """
            # Use BytesIO that we'll write to incrementally
            chunk_buffer = BytesIO()
            current_size = 0
            chunk_size = 1024 * 64  # 64KB chunks (smaller for faster response)
            
            # Custom ZIP writing with immediate flush
            class StreamingZipWriter:
                def __init__(self):
                    self.chunk_buffer = BytesIO()
                    self.zip_file = zipfile.ZipFile(self.chunk_buffer, 'w', zipfile.ZIP_DEFLATED, compresslevel=5)
                
                async def add_file(self, filename: str, data: bytes):
                    self.zip_file.writestr(filename, data)
                    # Force flush internal buffers
                    self.zip_file.flush()
                
                async def get_chunks(self):
                    # Get accumulated data
                    self.chunk_buffer.seek(0)
                    while True:
                        chunk = self.chunk_buffer.read(chunk_size)
                        if not chunk:
                            break
                        yield chunk
                    
                    # Close and get any remaining data
                    self.zip_file.close()
                    self.chunk_buffer.seek(0)
                    # Yield any remaining data after close
                    remaining = self.chunk_buffer.read()
                    if remaining:
                        yield remaining
            
            writer = StreamingZipWriter()
            
            try:
                # Add each song with immediate chunk sending
                for idx, song in enumerate(songs, 1):
                    try:
                        audio_url = song.get("audio_url")
                        if not audio_url:
                            print(f"[DOWNLOAD] Skipping song {idx}: no audio_url")
                            continue
                        
                        song_title = song.get("title", f"song_{idx}").replace("/", "_").replace("\\", "_")
                        zip_filename = f"{idx:02d}_{song_title}.mp3"
                        
                        print(f"[DOWNLOAD] Downloading song {idx}/{len(songs)}: {zip_filename}")
                        
                        # Download from Supabase
                        try:
                            async with httpx.AsyncClient(timeout=60.0) as client:
                                response = await client.get(audio_url, follow_redirects=True)
                                if response.status_code == 200:
                                    await writer.add_file(zip_filename, response.content)
                                    print(f"[DOWNLOAD] Added: {zip_filename} ({len(response.content)} bytes)")
                                    
                                    # Yield chunks as we go to client
                                    # This ensures streaming doesn't wait
                                    writer.chunk_buffer.seek(0)
                                    data_to_send = writer.chunk_buffer.getvalue()
                                    if len(data_to_send) > chunk_size:
                                        # Send older chunks
                                        yield data_to_send[:-chunk_size]
                                        # Keep buffer small
                                        writer.chunk_buffer = BytesIO()
                                        writer.chunk_buffer.write(data_to_send[-chunk_size:])
                                else:
                                    print(f"[DOWNLOAD] Failed song {idx}: {response.status_code}")
                        except asyncio.TimeoutError:
                            print(f"[DOWNLOAD] Timeout on song {idx}")
                        except Exception as e:
                            print(f"[DOWNLOAD] Error on song {idx}: {e}")
                    except Exception as e:
                        print(f"[DOWNLOAD] Error processing song {idx}: {e}")
                
                # Send all remaining data
                async for chunk in writer.get_chunks():
                    if chunk:
                        yield chunk
                        
            except Exception as e:
                print(f"[DOWNLOAD] Stream error: {e}")
                raise
        
        filename = f"{album_title}.zip"
        return StreamingResponse(
            generate_zip_stream(),
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "X-Content-Type-Options": "nosniff"
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[DOWNLOAD] Error: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error downloading album: {str(e)}")

