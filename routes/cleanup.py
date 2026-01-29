"""
Scheduled cleanup tasks for deleted albums.
This module handles:
1. Auto-deletion of albums after 30 days in trash
2. Storage file cleanup for permanently deleted albums
"""

from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from supabase import create_client
import os
from dotenv import load_dotenv
import jwt
from datetime import datetime, timedelta
import httpx

load_dotenv()

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
CLEANUP_SECRET = os.getenv("CLEANUP_SECRET", "your-secret-key")  # Chave secreta para chamar o endpoint

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

router = APIRouter(prefix="/cleanup", tags=["cleanup"])


@router.post("/auto-delete-old-albums")
async def auto_delete_old_albums(
    secret: Optional[str] = Header(None),
):
    """
    Auto-delete albums that have been in trash for more than 30 days.
    This endpoint should be called by a cron job (e.g., GitHub Actions, AWS Lambda).
    
    Requires: X-Cleanup-Secret header with correct secret key
    """
    try:
        # Verify secret key
        if secret != CLEANUP_SECRET:
            raise HTTPException(status_code=401, detail="Unauthorized - invalid secret key")
        
        print("[CLEANUP] Starting auto-delete of old trashed albums...")
        
        # Calculate date 30 days ago
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        thirty_days_ago_iso = thirty_days_ago.isoformat()
        
        print(f"[CLEANUP] Looking for albums deleted before: {thirty_days_ago_iso}")
        
        # Find albums that were deleted more than 30 days ago
        deleted_albums = supabase.table("albums").select("*").lt("deleted_at", thirty_days_ago_iso).execute()
        
        if not deleted_albums.data:
            print("[CLEANUP] No albums to delete")
            return {
                "success": True,
                "message": "No albums to delete",
                "deleted_count": 0
            }
        
        albums_to_delete = deleted_albums.data
        print(f"[CLEANUP] Found {len(albums_to_delete)} albums to permanently delete")
        
        deleted_count = 0
        error_count = 0
        
        for album in albums_to_delete:
            try:
                album_id = album.get("id")
                user_id = album.get("artist_id")
                
                print(f"[CLEANUP] Processing album {album_id} by user {user_id}")
                
                # Delete storage files
                try:
                    files_to_delete = []
                    
                    # Delete cover files by listing the albums directory
                    print(f"[CLEANUP] Listing cover files in: albums/{user_id}/{album_id}")
                    albums_dir = f"albums/{user_id}/{album_id}"
                    try:
                        list_albums = supabase.storage.from_("musica").list(albums_dir)
                        if list_albums:
                            print(f"[CLEANUP] Found {len(list_albums)} items in {albums_dir}")
                            for item in list_albums:
                                if hasattr(item, 'name'):
                                    file_path = f"{albums_dir}/{item.name}"
                                    files_to_delete.append(file_path)
                                    print(f"[CLEANUP] Marked cover for deletion: {file_path}")
                                elif isinstance(item, dict) and 'name' in item:
                                    file_path = f"{albums_dir}/{item['name']}"
                                    files_to_delete.append(file_path)
                                    print(f"[CLEANUP] Marked cover for deletion: {file_path}")
                        else:
                            print(f"[CLEANUP] No cover files found in {albums_dir}")
                    except Exception as e:
                        print(f"[CLEANUP] Error listing cover files: {e}")
                    
                    # Delete song files by listing directory
                    print(f"[CLEANUP] Listing song files in: songs/{album_id}")
                    songs_dir = f"songs/{album_id}"
                    try:
                        list_response = supabase.storage.from_("musica").list(songs_dir)
                        if list_response:
                            print(f"[CLEANUP] Found {len(list_response)} items in {songs_dir}")
                            for item in list_response:
                                if hasattr(item, 'name'):
                                    file_path = f"{songs_dir}/{item.name}"
                                    files_to_delete.append(file_path)
                                    print(f"[CLEANUP] Marked song for deletion: {file_path}")
                                elif isinstance(item, dict) and 'name' in item:
                                    file_path = f"{songs_dir}/{item['name']}"
                                    files_to_delete.append(file_path)
                                    print(f"[CLEANUP] Marked song for deletion: {file_path}")
                        else:
                            print(f"[CLEANUP] No files found in {songs_dir}")
                    except Exception as e:
                        print(f"[CLEANUP] Error listing song files: {e}")
                    
                    # Delete all collected files
                    if files_to_delete:
                        print(f"[CLEANUP] Deleting {len(files_to_delete)} files...")
                        try:
                            supabase.storage.from_("musica").remove(files_to_delete)
                            print(f"[CLEANUP] Successfully deleted {len(files_to_delete)} files")
                        except Exception as e:
                            print(f"[CLEANUP] Error deleting files: {e}")
                    else:
                        print(f"[CLEANUP] No files to delete for album {album_id}")
                    
                    # Verify directories are clean
                    print(f"[CLEANUP] Verifying directories are clean...")
                    try:
                        albums_dir = f"albums/{user_id}/{album_id}"
                        try:
                            list_albums = supabase.storage.from_("musica").list(albums_dir)
                            if not list_albums or len(list_albums) == 0:
                                print(f"[CLEANUP] ✓ Directory cleaned: {albums_dir}")
                            else:
                                print(f"[CLEANUP] ⚠ Directory not empty: {albums_dir}")
                        except Exception as e:
                            print(f"[CLEANUP] ✓ Directory removed: {albums_dir}")
                        
                        songs_dir = f"songs/{album_id}"
                        try:
                            list_songs = supabase.storage.from_("musica").list(songs_dir)
                            if not list_songs or len(list_songs) == 0:
                                print(f"[CLEANUP] ✓ Directory cleaned: {songs_dir}")
                            else:
                                print(f"[CLEANUP] ⚠ Directory not empty: {songs_dir}")
                        except Exception as e:
                            print(f"[CLEANUP] ✓ Directory removed: {songs_dir}")
                    except Exception as e:
                        print(f"[CLEANUP] Error verifying cleanup: {e}")
                    
                    
                except Exception as e:
                    print(f"[CLEANUP] Error in storage deletion for album {album_id}: {e}")
                
                # Delete songs from database
                print(f"[CLEANUP] Deleting songs from database")
                supabase.table("songs").delete().eq("album_id", album_id).execute()
                
                # Delete album from database
                print(f"[CLEANUP] Deleting album from database")
                supabase.table("albums").delete().eq("id", album_id).execute()
                
                print(f"[CLEANUP] Album {album_id} permanently deleted")
                deleted_count += 1
                
            except Exception as e:
                print(f"[CLEANUP] Error processing album {album.get('id')}: {e}")
                error_count += 1
                continue
        
        response = {
            "success": True,
            "message": f"Cleanup completed: {deleted_count} albums deleted, {error_count} errors",
            "deleted_count": deleted_count,
            "error_count": error_count
        }
        
        print(f"[CLEANUP] Cleanup response: {response}")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[CLEANUP] Error during cleanup: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error during cleanup: {str(e)}")


@router.post("/publish-scheduled-albums")
async def publish_scheduled_albums(
    secret: Optional[str] = Header(None, alias="X-Cleanup-Secret"),
):
    """
    Publish albums that have reached their scheduled publish date.
    This endpoint should be called by a cron job periodically (e.g., every minute).
    
    Requires: X-Cleanup-Secret header with correct secret key
    """
    try:
        # Verify secret key
        if secret != CLEANUP_SECRET:
            raise HTTPException(status_code=401, detail="Unauthorized - invalid secret key")
        
        print("[SCHEDULED] Checking for albums to publish...")
        
        now = datetime.utcnow()
        now_iso = now.isoformat()
        
        print(f"[SCHEDULED] Current time: {now_iso}")
        
        # Find albums that are scheduled and their publish time has passed
        scheduled_albums = supabase.table("albums").select("*").eq("is_scheduled", True).lte("scheduled_publish_at", now_iso).execute()
        
        if not scheduled_albums.data:
            print("[SCHEDULED] No albums to publish")
            return {
                "success": True,
                "message": "No albums to publish",
                "published_count": 0
            }
        
        albums_to_publish = scheduled_albums.data
        print(f"[SCHEDULED] Found {len(albums_to_publish)} albums to publish")
        
        published_count = 0
        error_count = 0
        
        for album in albums_to_publish:
            try:
                album_id = album.get("id")
                title = album.get("title")
                
                print(f"[SCHEDULED] Publishing album: {title} (ID: {album_id})")
                
                # Update album: set is_private to false, is_scheduled to false
                supabase.table("albums").update({
                    "is_private": False,
                    "is_scheduled": False
                }).eq("id", album_id).execute()
                
                print(f"[SCHEDULED] Album published: {title}")
                published_count += 1
                
            except Exception as e:
                print(f"[SCHEDULED] Error publishing album {album.get('id')}: {e}")
                error_count += 1
                continue
        
        response = {
            "success": True,
            "message": f"Published {published_count} albums, {error_count} errors",
            "published_count": published_count,
            "error_count": error_count
        }
        
        print(f"[SCHEDULED] Response: {response}")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[SCHEDULED] Error during publish: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error during publish: {str(e)}")


@router.get("/status")
async def cleanup_status():
    """
    Check the status of albums in trash.
    """
    try:
        print("[CLEANUP] Checking trash status...")
        
        # Get count of trashed albums
        trashed_albums = supabase.table("albums").select("id, deleted_at, title, artist_name").is_("deleted_at", None, negate=True).execute()
        
        if not trashed_albums.data:
            return {
                "success": True,
                "message": "No albums in trash",
                "trashed_count": 0,
                "albums": []
            }
        
        albums = trashed_albums.data
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        
        albums_info = []
        auto_delete_count = 0
        
        for album in albums:
            deleted_at = album.get("deleted_at")
            if deleted_at:
                try:
                    # Parse ISO datetime
                    if isinstance(deleted_at, str):
                        deleted_date = datetime.fromisoformat(deleted_at.replace('Z', '+00:00'))
                    else:
                        deleted_date = deleted_at
                    
                    days_in_trash = (datetime.utcnow() - deleted_date.replace(tzinfo=None)).days
                    will_auto_delete = deleted_date < thirty_days_ago
                    
                    if will_auto_delete:
                        auto_delete_count += 1
                    
                    albums_info.append({
                        "id": album.get("id"),
                        "title": album.get("title"),
                        "artist": album.get("artist_name"),
                        "deleted_at": deleted_at,
                        "days_in_trash": days_in_trash,
                        "will_auto_delete": will_auto_delete,
                        "days_until_delete": max(0, 30 - days_in_trash)
                    })
                except Exception as e:
                    print(f"[CLEANUP] Error parsing date for album {album.get('id')}: {e}")
                    continue
        
        return {
            "success": True,
            "trashed_count": len(albums),
            "auto_delete_count": auto_delete_count,
            "albums": albums_info
        }
        
    except Exception as e:
        import traceback
        print(f"[CLEANUP] Error checking status: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error checking status: {str(e)}")
