from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
import asyncio
import json
from typing import Optional
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/upload-progress", tags=["upload-progress"])

# Global state for tracking uploads
# Format: {upload_id: {"progress": 0-100, "step": "...", "start_time": datetime}}
upload_progress = {}

def update_progress(upload_id: str, progress: int, step: str):
    """Update upload progress"""
    try:
        loop = asyncio.get_event_loop()
        now = loop.time()
    except:
        import time
        now = time.time()
    
    if upload_id not in upload_progress:
        upload_progress[upload_id] = {
            "start_time": now,
            "updates": []
        }
    
    elapsed = int(now - upload_progress[upload_id]["start_time"])
    
    # Ensure progress is between 0 and 99 (100 only at the very end)
    progress = min(max(progress, 0), 99)
    
    # Store update
    upload_progress[upload_id]["updates"].append({
        "progress": progress,
        "step": step,
        "elapsed_seconds": elapsed,
        "timestamp": datetime.utcnow().isoformat()
    })
    
    # Keep only last 100 updates to prevent memory leak
    if len(upload_progress[upload_id]["updates"]) > 100:
        upload_progress[upload_id]["updates"] = upload_progress[upload_id]["updates"][-100:]

def complete_progress(upload_id: str):
    """Mark upload as complete (100%)"""
    if upload_id in upload_progress:
        try:
            loop = asyncio.get_event_loop()
            now = loop.time()
        except:
            import time
            now = time.time()
        
        elapsed = int(now - upload_progress[upload_id]["start_time"])
        upload_progress[upload_id]["updates"].append({
            "progress": 100,
            "step": "completed",
            "elapsed_seconds": elapsed,
            "timestamp": datetime.utcnow().isoformat()
        })

@router.get("/progress/{upload_id}")
async def get_upload_progress(upload_id: str, token: Optional[str] = Query(None)):
    """
    Server-Sent Events endpoint to stream upload progress.
    Sends updates in real-time as they arrive from the backend.
    """
    async def progress_generator():
        """Generate progress updates using SSE format"""
        last_sent_index = 0
        max_wait = 120  # 2 minutes max wait for updates
        wait_iterations = 0
        
        while True:
            # Check if we have new updates
            if upload_id in upload_progress:
                updates = upload_progress[upload_id]["updates"]
                
                # Send any new updates since last check
                while last_sent_index < len(updates):
                    update = updates[last_sent_index]
                    yield f"data: {json.dumps(update)}\n\n"
                    last_sent_index += 1
                    wait_iterations = 0  # Reset wait counter
                    
                    # Small delay between updates for streaming effect
                    await asyncio.sleep(0.01)
                
                # If we've reached 100% or completed, we're done
                if last_sent_index > 0 and (updates[-1]["progress"] >= 100 or updates[-1].get("step") in ["completed", "concluido"]):
                    break
            
            # Wait a bit before checking again
            await asyncio.sleep(0.1)
            wait_iterations += 1
            
            # Safety timeout after 2 minutes
            if wait_iterations > (max_wait * 10):
                if upload_id in upload_progress:
                    # Force completion if stuck
                    final_update = {
                        "progress": 100,
                        "step": "timeout_completed",
                        "elapsed_seconds": max_wait
                    }
                    yield f"data: {json.dumps(final_update)}\n\n"
                break
        
        # Cleanup old upload data after 10 minutes
        if upload_id in upload_progress:
            try:
                loop = asyncio.get_event_loop()
                now = loop.time()
            except:
                import time
                now = time.time()
            
            start_time = upload_progress[upload_id]["start_time"]
            if (now - start_time) > 600:  # 600 seconds = 10 minutes
                del upload_progress[upload_id]
    
    return StreamingResponse(
        progress_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive"
        }
    )

@router.get("/status/{upload_id}")
async def get_upload_status(upload_id: str):
    """Get current upload status"""
    print(f"[STATUS] Getting status for {upload_id}")
    print(f"[STATUS] Known uploads: {list(upload_progress.keys())}")
    
    if upload_id not in upload_progress:
        print(f"[STATUS] Upload {upload_id} not found")
        return {"status": "not_found", "progress": 0}
    
    updates = upload_progress[upload_id]["updates"]
    print(f"[STATUS] Found {len(updates)} updates for {upload_id}")
    
    if not updates:
        print(f"[STATUS] No updates yet for {upload_id}")
        return {"status": "waiting", "progress": 0}
    
    latest = updates[-1]
    result = {
        "status": "in_progress" if latest["progress"] < 100 else "completed",
        "progress": latest["progress"],
        "step": latest["step"],
        "elapsed_seconds": latest["elapsed_seconds"]
    }
    print(f"[STATUS] Returning: {result}")
    return result

@router.delete("/progress/{upload_id}")
async def clear_progress(upload_id: str):
    """Clear progress for an upload"""
    if upload_id in upload_progress:
        del upload_progress[upload_id]
    return {"status": "cleared"}
