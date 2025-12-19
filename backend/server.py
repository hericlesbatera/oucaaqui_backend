from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from routes.albums import router as albums_router
from routes.album_upload import router as album_upload_router
from routes.upload_progress import router as upload_progress_router
from routes.artists import router as artists_router
from routes.artist_videos import router as artist_videos_router
from routes.cleanup import router as cleanup_router
from routes.music_files import router as music_files_router

app = FastAPI()

# Adicionar CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(albums_router)
app.include_router(album_upload_router)
app.include_router(upload_progress_router)
app.include_router(artists_router)
app.include_router(artist_videos_router)
app.include_router(cleanup_router)
app.include_router(music_files_router)

@app.get("/health")
def health_check():
    return {"status": "ok"}

# Serve static files from public directory (frontend build)
public_path = Path(__file__).parent / "public"
if public_path.exists():
    app.mount("/", StaticFiles(directory=str(public_path), html=True), name="static")
