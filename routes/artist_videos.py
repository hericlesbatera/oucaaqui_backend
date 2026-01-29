from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import os
from supabase import create_client
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv()

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

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
        
        # Insert into Supabase
        result = supabase.table("artist_videos").insert(video_data).execute()
        
        if hasattr(result, 'data') and result.data:
            print(f"[ARTIST-VIDEOS] Video added successfully: {result.data}")
            return {
                "success": True,
                "video": result.data[0],
                "message": "Video added successfully"
            }
        else:
            print(f"[ARTIST-VIDEOS] No data returned from insert")
            raise HTTPException(status_code=500, detail="Failed to insert video")
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ARTIST-VIDEOS] Error adding video: {e}")
        import traceback
        print(f"[ARTIST-VIDEOS] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))
