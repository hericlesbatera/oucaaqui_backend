"""Authentication and artist profile management endpoints."""
from fastapi import APIRouter, HTTPException, Request
import jwt
from . import auth_utils
from supabase import create_client
import os
from dotenv import load_dotenv
import json

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/init-artist-profile")
async def init_artist_profile(request: Request):
    """
    Initialize artist profile after email confirmation.
    Called by frontend after user confirms email.
    
    Request body:
    {
        "artist_name": "Nome do Artista",
        "artist_slug": "nome-slug",
        "cidade": "São Paulo",
        "estado": "SP",
        "genero": "Rock",
        "estilo_musical": "Rock Alternativo"
    }
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
            print(f"[AUTH] Error decoding token: {e}")
            raise HTTPException(status_code=401, detail="Invalid token")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Could not extract user from token")
        
        print(f"[AUTH] Init artist profile request for user: {user_id}")
        
        # Parse request body
        try:
            body = await request.json()
        except:
            body = {}
        
        artist_name = body.get("artist_name", "Artista")
        artist_slug = body.get("artist_slug", "")
        cidade = body.get("cidade", "")
        estado = body.get("estado", "")
        genero = body.get("genero", "")
        estilo_musical = body.get("estilo_musical", "")
        
        print(f"[AUTH] Artist data: name={artist_name}, slug={artist_slug}")
        
        # Check if artist already exists
        artist_check = supabase.table("artists").select("id").eq("id", user_id).execute()
        
        if artist_check.data and len(artist_check.data) > 0:
            print(f"[AUTH] Artist already exists: {user_id}")
            return {
                "success": True,
                "message": "Artist profile already exists",
                "already_exists": True,
                "artist_id": user_id
            }
        
        # Create artist profile
        print(f"[AUTH] Creating artist profile for: {user_id}")
        
        artist_data = {
            "id": user_id,
            "name": artist_name,
            "slug": artist_slug if artist_slug else artist_name.lower().replace(" ", "-"),
            "email": "",  # Will be updated from auth.users if needed
            "cidade": cidade,
            "estado": estado,
            "genero": genero,
            "estilo_musical": estilo_musical,
            "bio": "",
            "avatar_url": "",
            "cover_url": "",
            "followers_count": 0,
            "is_verified": False
        }
        
        print(f"[AUTH] Inserting artist data: {artist_data}")
        
        artist_response = supabase.table("artists").insert(artist_data).execute()
        
        print(f"[AUTH] Artist response: {artist_response}")
        if hasattr(artist_response, 'data'):
            print(f"[AUTH] Artist response data: {artist_response.data}")
        
        if artist_response.data and len(artist_response.data) > 0:
            print(f"[AUTH] Artist profile created successfully: {user_id}")
            return {
                "success": True,
                "message": "Artist profile created successfully",
                "artist_id": user_id,
                "already_exists": False
            }
        else:
            # Check if it failed due to existing record (idempotent)
            artist_recheck = supabase.table("artists").select("id").eq("id", user_id).execute()
            if artist_recheck.data and len(artist_recheck.data) > 0:
                print(f"[AUTH] Artist exists after creation attempt: {user_id}")
                return {
                    "success": True,
                    "message": "Artist profile already exists",
                    "already_exists": True,
                    "artist_id": user_id
                }
            
            print(f"[AUTH] Failed to create artist: {artist_response}")
            if hasattr(artist_response, 'error'):
                print(f"[AUTH] Error details: {artist_response.error}")
            
            raise Exception(f"Failed to create artist profile")
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"[AUTH] Error initializing artist profile: {e}")
        import traceback
        print(f"[AUTH] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error initializing artist profile: {str(e)}")


@router.post("/ensure-artist")
async def ensure_artist_exists(request: Request):
    """
    Ensure artist profile exists (idempotent).
    Used as fallback in various parts of the app.
    
    Request body:
    {
        "artist_name": "Nome do Artista"
    }
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
        
        # Parse request body
        try:
            body = await request.json()
        except:
            body = {}
        
        artist_name = body.get("artist_name", "Artista")
        
        print(f"[AUTH] Ensuring artist exists: {user_id}")
        
        # Use utility function
        success = auth_utils.ensure_artist_exists(user_id, artist_name)
        
        if success:
            return {
                "success": True,
                "message": "Artist profile ensured",
                "artist_id": user_id
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to ensure artist profile")
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"[AUTH] Error: {e}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/profile")
async def get_profile(request: Request):
    """
    Get current user's profile (artist or user).
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
        
        # Check if artist profile exists
        artist_response = supabase.table("artists").select("*").eq("id", user_id).maybeSingle().execute()
        
        if artist_response.data:
            return {
                "success": True,
                "type": "artist",
                "profile": artist_response.data
            }
        else:
            return {
                "success": True,
                "type": "user",
                "profile": None
            }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
