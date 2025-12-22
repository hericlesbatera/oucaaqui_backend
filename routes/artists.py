from fastapi import APIRouter, Query, HTTPException
from typing import List, Optional

router = APIRouter(prefix="/artists", tags=["artists"])

@router.get("/search")
async def search_artists(q: str = Query(..., min_length=1)):
    """
    Search for artists by name.
    """
    try:
        if not q or len(q) < 1:
            raise HTTPException(status_code=400, detail="Query parameter 'q' is required")
        
        # TODO: Implement Supabase search
        # For now, return mock results
        return {
            "query": q,
            "results": [
                {
                    "id": "artist-1",
                    "name": f"Artist matching '{q}'",
                    "slug": f"artist-{q.lower().replace(' ', '-')}",
                    "avatar_url": None
                }
            ]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
