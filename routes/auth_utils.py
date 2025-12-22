"""Utility functions for authentication and artist management."""
from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


async def ensure_artist_exists(user_id: str, artist_name: str = None) -> bool:
    """
    Ensure an artist record exists for the given user_id.
    Creates one if it doesn't exist.
    
    Args:
        user_id: The user ID from Supabase Auth
        artist_name: Optional artist name (defaults to "Artista")
    
    Returns:
        bool: True if artist exists or was created successfully, False otherwise
    """
    try:
        # Check if artist already exists
        artist_check = supabase.table("artists").select("id").eq("id", user_id).execute()
        
        if artist_check.data and len(artist_check.data) > 0:
            print(f"[AUTH] Artist already exists: {user_id}")
            return True
        
        # Artist doesn't exist, create one
        print(f"[AUTH] Creating new artist record for: {user_id}")
        artist_data = {
            "id": user_id,
            "name": artist_name or "Artista",
        }
        
        artist_response = supabase.table("artists").insert(artist_data).execute()
        
        if artist_response.data and len(artist_response.data) > 0:
            print(f"[AUTH] Artist created successfully: {user_id}")
            return True
        else:
            print(f"[AUTH] Failed to create artist: {artist_response}")
            return False
            
    except Exception as e:
        print(f"[AUTH] Error ensuring artist exists: {e}")
        return False
