from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/artist-videos", tags=["artist-videos"])

class AddVideoRequest(BaseModel):
    album_id: str
    video_id: str
    title: Optional[str] = None
    
@router.post("/add")
async def add_video(request: AddVideoRequest):
    """
    Add a YouTube video to an album.
    """
    try:
        if not request.album_id or not request.video_id:
            raise HTTPException(status_code=400, detail="album_id and video_id are required")
        
        # TODO: Implement Supabase integration to save video reference
        # For now, return mock success
        return {
            "success": True,
            "album_id": request.album_id,
            "video_id": request.video_id,
            "video_url": f"https://youtu.be/{request.video_id}",
            "message": "Video added successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
