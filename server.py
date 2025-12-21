from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
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

# Serve static files from public directory (frontend build)
public_path = Path(__file__).parent / "public"
if public_path.exists():
    # Servir arquivos CSS, JS, etc. com prefixo
    app.mount("/static", StaticFiles(directory=str(public_path), check_dir=True), name="static")
    
    # Fallback route para React Router - deve ser a última rota
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = public_path / full_path
        
        # Se é um arquivo estático que existe, serve
        if file_path.is_file():
            return FileResponse(file_path)
        
        # Caso contrário, serve index.html (para React Router)
        index_path = public_path / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        
        return {"detail": "Not Found"}
