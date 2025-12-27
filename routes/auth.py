"""Authentication endpoints for artist profile creation."""
from fastapi import APIRouter, HTTPException, Request
import jwt
from . import auth_utils
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/init-artist-profile")
async def init_artist_profile(request: Request):
    """
    Initialize artist profile after signup.
    Called by frontend after user confirms email.
    """
    try:
        # Get auth token
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            raise HTTPException(status_code=401, detail="Authorization header required")
        
        # Extract user ID from token
        token = auth_header.replace("Bearer ", "").strip()
        try:
            decoded = jwt.decode(token, options={"verify_signature": False})
            user_id = decoded.get("sub")
        except Exception as e:
            print(f"Error decoding token: {e}")
            raise HTTPException(status_code=401, detail="Invalid token")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Could not extract user from token")
        
        # Parse request body
        try:
            body = await request.json()
        except Exception as e:
            print(f"Error parsing request body: {e}")
            body = {}
        
        artist_name = body.get("artist_name", "Artista")
        artist_slug = body.get("artist_slug", "")
        cidade = body.get("cidade", "")
        estado = body.get("estado", "")
        genero = body.get("genero", "")
        estilo_musical = body.get("estilo_musical", "")
        
        print(f"[AUTH] Init artist profile request for user: {user_id}")
        print(f"[AUTH] Artist name: {artist_name}, slug: {artist_slug}")
        
        # Use auth_utils to ensure artist exists
        success = auth_utils.ensure_artist_exists(user_id, artist_name)
        
        if success:
            print(f"[AUTH] Artist profile initialized for: {user_id}")
            return {
                "success": True,
                "message": "Artist profile initialized successfully",
                "artist_id": user_id
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to initialize artist profile")
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"[AUTH] Error: {e}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error initializing artist profile: {str(e)}")


@router.post("/ensure-artist")
async def ensure_artist_exists(request: Request):
    """
    Ensure artist profile exists (idempotent).
    Used as fallback in various parts of the app.
    """
    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            raise HTTPException(status_code=401, detail="Authorization header required")
        
        token = auth_header.replace("Bearer ", "").strip()
        try:
            decoded = jwt.decode(token, options={"verify_signature": False})
            user_id = decoded.get("sub")
        except Exception as e:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Could not extract user from token")
        
        try:
            body = await request.json()
        except:
            body = {}
        
        artist_name = body.get("artist_name", "Artista")
        
        # Use utility function
        success = auth_utils.ensure_artist_exists(user_id, artist_name)
        
        if success:
            return {"success": True, "message": "Artist profile ensured"}
        else:
            raise HTTPException(status_code=500, detail="Failed to ensure artist profile")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/profile")
async def get_artist_profile(request: Request):
    """
    Check if user has an artist profile.
    """
    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            raise HTTPException(status_code=401, detail="Authorization header required")
        
        token = auth_header.replace("Bearer ", "").strip()
        try:
            decoded = jwt.decode(token, options={"verify_signature": False})
            user_id = decoded.get("sub")
        except Exception as e:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Could not extract user from token")
        
        from supabase import create_client
        SUPABASE_URL = os.getenv("SUPABASE_URL")
        SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        
        # Check if artist exists
        artist_check = supabase.table("artists").select("*").eq("id", user_id).maybeSingle().execute()
        
        if artist_check.data:
            return {"success": True, "profile": artist_check.data}
        else:
            return {"success": False, "message": "No artist profile found"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
