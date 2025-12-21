from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.albums import router as albums_router
from routes.album_upload import router as album_upload_router
from routes.upload_progress import router as upload_progress_router
from routes.artists import router as artists_router
from routes.artist_videos import router as artist_videos_router
from routes.cleanup import router as cleanup_router
from routes.music_files import router as music_files_router
from routes.album_download import router as album_download_router
from routes.admin import router as admin_router

app = FastAPI()

# Adicionar CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers with /api prefix
app.include_router(albums_router, prefix="/api")
app.include_router(album_upload_router, prefix="/api")
app.include_router(upload_progress_router, prefix="/api")
app.include_router(artists_router, prefix="/api")
app.include_router(artist_videos_router, prefix="/api")
app.include_router(cleanup_router, prefix="/api")
app.include_router(music_files_router, prefix="/api")
app.include_router(album_download_router, prefix="/api")
app.include_router(admin_router, prefix="/api")

@app.get("/health")
def health_check():
    return {"status": "ok"}
