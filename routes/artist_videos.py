from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import os
from dotenv import load_dotenv
from datetime import datetime, timezone
import httpx

load_dotenv()

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")

router = APIRouter(prefix="/artist-videos", tags=["artist-videos"])

class AddVideoRequest(BaseModel):
    artist_id: str
    album_id: Optional[str] = None
    video_url: str
    video_id: str
    title: Optional[str] = None
    thumbnail: Optional[str] = None
    is_public: Optional[bool] = True
    
@router.post("/add")
async def add_video(request: AddVideoRequest):
    """
    Add a YouTube video to an album or artist profile.
    """
    try:
        if not request.artist_id or not request.video_id:
            raise HTTPException(status_code=400, detail="artist_id and video_id are required")
        
        # Prepare video data
        video_data = {
            "artist_id": request.artist_id,
            "video_url": request.video_url,
            "video_id": request.video_id,
            "title": request.title or "Vídeo do YouTube",
            "thumbnail": request.thumbnail or f"https://img.youtube.com/vi/{request.video_id}/maxresdefault.jpg",
            "is_public": request.is_public if request.is_public is not None else True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Add album_id if provided
        if request.album_id:
            video_data["album_id"] = request.album_id
        
        print(f"[ARTIST-VIDEOS] Adding video: {video_data}")
        
        # Usar httpx diretamente para bypass RLS e garantir que album_id seja salvo
        async with httpx.AsyncClient(timeout=30.0) as client:
            insert_url = f"{SUPABASE_URL}/rest/v1/artist_videos"
            headers = {
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "apikey": SUPABASE_SERVICE_KEY,
                "Content-Type": "application/json",
                "Prefer": "return=representation"
            }
            response = await client.post(insert_url, json=video_data, headers=headers)
            
            print(f"[ARTIST-VIDEOS] Insert response status: {response.status_code}")
            print(f"[ARTIST-VIDEOS] Insert response: {response.text}")
            
            if response.status_code in [200, 201]:
                result_data = response.json()
                if result_data and len(result_data) > 0:
                    print(f"[ARTIST-VIDEOS] Video added successfully: {result_data}")
                    return {
                        "success": True,
                        "video": result_data[0],
                        "message": "Video added successfully"
                    }
                else:
                    print(f"[ARTIST-VIDEOS] No data returned from insert")
                    raise HTTPException(status_code=500, detail="Failed to insert video")
            else:
                print(f"[ARTIST-VIDEOS] Error inserting video: {response.status_code}")
                raise HTTPException(status_code=500, detail=f"Failed to insert video: {response.text}")
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ARTIST-VIDEOS] Error adding video: {e}")
        import traceback
        print(f"[ARTIST-VIDEOS] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))
