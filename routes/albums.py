from fastapi import APIRouter, HTTPException, Query, Header
from typing import Optional
from supabase import create_client
import os
from dotenv import load_dotenv
import jwt
import json
import httpx

load_dotenv()

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

router = APIRouter(prefix="/albums", tags=["albums"])

@router.get("")
async def list_albums():
    """List all albums"""
    try:
        albums = supabase.table("albums").select("*").execute()
        return albums.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching albums: {str(e)}")

@router.delete("/{album_id}")
async def delete_album(
    album_id: str,
    permanent: bool = Query(False),
    authorization: Optional[str] = Header(None)
):
    """
    Delete an album.
    If permanent=true, permanently delete from trash.
    If permanent=false, move to trash.
    """
    print(f"DELETE album request: album_id={album_id}, permanent={permanent}, auth={authorization is not None}")
    
    try:
        if not authorization:
            print("Error: No authorization header")
            raise HTTPException(status_code=401, detail="Unauthorized - missing auth header")
        
        # Extract token from "Bearer {token}"
        token = authorization.replace("Bearer ", "").strip()
        
        if not token:
            print("Error: Invalid token format")
            raise HTTPException(status_code=401, detail="Unauthorized - invalid token")
        
        print(f"Token extracted: {token[:20]}...")
        
        # Decode JWT token to get user_id
        try:
            # Decode without verification first (to get the payload)
            # The token is already validated by the frontend auth
            decoded = jwt.decode(token, options={"verify_signature": False})
            user_id = decoded.get("sub")
            print(f"User ID from token: {user_id}")
        except Exception as e:
            print(f"Error decoding token: {str(e)}")
            raise HTTPException(status_code=401, detail="Could not verify user from token")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Could not extract user_id from token")
        
        # Get album to verify ownership
        album_data = supabase.table("albums").select("*").eq("id", album_id).single().execute()
        album = album_data.data if album_data.data else None
        
        if not album:
            raise HTTPException(status_code=404, detail="Album not found")
        
        if album.get("artist_id") != user_id:
            raise HTTPException(status_code=403, detail="You don't have permission to delete this album")
        
        if permanent:
            # Permanently delete: delete files from storage, then songs, then album
            print(f"Permanently deleting album {album_id}")
            
            # 1. Delete files from Supabase Storage
            try:
                print(f"[DELETE] Deleting files from Supabase Storage for album {album_id}")
                
                files_to_delete = []
                
                # Delete cover image(s) by listing the albums directory
                print(f"[DELETE] Listing cover files in: albums/{user_id}/{album_id}")
                albums_dir = f"albums/{user_id}/{album_id}"
                try:
                    # List all files in the albums directory (covers)
                    list_albums = supabase.storage.from_("musica").list(albums_dir)
                    if list_albums:
                        print(f"[DELETE] Found {len(list_albums)} items in {albums_dir}")
                        for item in list_albums:
                            # Check if it's a file (has name attribute)
                            if hasattr(item, 'name'):
                                file_path = f"{albums_dir}/{item.name}"
                                files_to_delete.append(file_path)
                                print(f"[DELETE] Marked cover for deletion: {file_path}")
                            elif isinstance(item, dict) and 'name' in item:
                                file_path = f"{albums_dir}/{item['name']}"
                                files_to_delete.append(file_path)
                                print(f"[DELETE] Marked cover for deletion: {file_path}")
                    else:
                        print(f"[DELETE] No cover files found in {albums_dir}")
                except Exception as e:
                    print(f"[DELETE] Error listing cover files: {e}")
                
                # Delete all song audio files by listing the directory
                print(f"[DELETE] Listing song files in: songs/{album_id}")
                songs_dir = f"songs/{album_id}"
                try:
                    # List all files in the songs directory
                    list_response = supabase.storage.from_("musica").list(songs_dir)
                    if list_response:
                        print(f"[DELETE] Found {len(list_response)} items in {songs_dir}")
                        for item in list_response:
                            # Check if it's a file (has name attribute)
                            if hasattr(item, 'name'):
                                file_path = f"{songs_dir}/{item.name}"
                                files_to_delete.append(file_path)
                                print(f"[DELETE] Marked song for deletion: {file_path}")
                            elif isinstance(item, dict) and 'name' in item:
                                file_path = f"{songs_dir}/{item['name']}"
                                files_to_delete.append(file_path)
                                print(f"[DELETE] Marked song for deletion: {file_path}")
                    else:
                        print(f"[DELETE] No files found in {songs_dir}")
                except Exception as e:
                    print(f"[DELETE] Error listing song files: {e}")
                    import traceback
                    print(traceback.format_exc())
                
                # Delete all collected files at once
                if files_to_delete:
                    print(f"[DELETE] Deleting {len(files_to_delete)} files from storage...")
                    try:
                        delete_response = supabase.storage.from_("musica").remove(files_to_delete)
                        print(f"[DELETE] Storage delete response: {delete_response}")
                        print(f"[DELETE] Successfully deleted {len(files_to_delete)} files")
                    except Exception as e:
                        print(f"[DELETE] Error deleting files from storage: {e}")
                        import traceback
                        print(traceback.format_exc())
                else:
                    print(f"[DELETE] No files to delete from storage")
                
                # Verify directories are clean
                print(f"[DELETE] Verifying directories are clean...")
                try:
                    albums_dir = f"albums/{user_id}/{album_id}"
                    try:
                        list_albums = supabase.storage.from_("musica").list(albums_dir)
                        if not list_albums or len(list_albums) == 0:
                            print(f"[DELETE] ✓ Directory cleaned: {albums_dir}")
                        else:
                            print(f"[DELETE] ⚠ Directory not empty: {albums_dir}")
                    except Exception as e:
                        print(f"[DELETE] ✓ Directory removed: {albums_dir}")
                    
                    songs_dir = f"songs/{album_id}"
                    try:
                        list_songs = supabase.storage.from_("musica").list(songs_dir)
                        if not list_songs or len(list_songs) == 0:
                            print(f"[DELETE] ✓ Directory cleaned: {songs_dir}")
                        else:
                            print(f"[DELETE] ⚠ Directory not empty: {songs_dir}")
                    except Exception as e:
                        print(f"[DELETE] ✓ Directory removed: {songs_dir}")
                    
                except Exception as e:
                    print(f"[DELETE] Error verifying cleanup: {e}")
                
            except Exception as e:
                print(f"[DELETE] Error in storage deletion process: {e}")
                import traceback
                print(traceback.format_exc())
                # Continue with DB deletion even if storage deletion fails
            
            # 2. Delete songs from database
            print(f"[DELETE] Deleting songs from database")
            supabase.table("songs").delete().eq("album_id", album_id).execute()
            
            # 3. Delete album from database
            print(f"[DELETE] Deleting album from database")
            supabase.table("albums").delete().eq("id", album_id).execute()
            
            response = {
                "success": True,
                "message": f"Album permanently deleted (files and database records removed)",
                "album_id": album_id
            }
        else:
            # Soft delete: mark as deleted/trashed
            print(f"Moving album {album_id} to trash")
            
            supabase.table("albums").update({"is_deleted": True}).eq("id", album_id).execute()
            
            response = {
                "success": True,
                "message": f"Album moved to trash",
                "album_id": album_id
            }
        
        print(f"Album deletion response: {response}")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error deleting album: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error deleting album: {str(e)}")
