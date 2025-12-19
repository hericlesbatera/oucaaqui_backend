from fastapi import APIRouter, HTTPException, Request
import os
import uuid
import json
import asyncio
import zipfile
import shutil
import unicodedata
import re
from typing import Optional
from pathlib import Path
from supabase import create_client
from dotenv import load_dotenv
import jwt
import rarfile
import httpx
from io import BytesIO
from . import upload_progress as progress_module

load_dotenv()

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

router = APIRouter(prefix="/api/album-upload", tags=["album-upload"])

# Global state for upload progress tracking
upload_progress = {}

def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename for Supabase Storage (remove accents, special chars).
    Converts "Música.mp3" -> "Musica.mp3"
    """
    # Remove accents
    nfd = unicodedata.normalize('NFD', filename)
    clean = ''.join(char for char in nfd if unicodedata.category(char) != 'Mn')
    
    # Remove other special characters (keep only alphanumeric, dots, hyphens, underscores)
    clean = re.sub(r'[^\w\s.-]', '', clean)
    
    # Replace spaces with underscores or hyphens
    clean = re.sub(r'\s+', '_', clean)
    
    return clean

@router.post("/upload")
async def upload_album(request: Request):
    """
    Upload a new album with all metadata.
    Extracts ZIP, uploads files to Supabase Storage, and saves metadata.
    """
    try:
        # Parse form data
        form_data = await request.form()
        
        print(f"Form data keys: {list(form_data.keys())}")
        
        # Extract form fields
        title = form_data.get("title", "")
        description = form_data.get("description", "")
        genre = form_data.get("genre", "")
        tags_str = form_data.get("tags", "[]")
        is_public = form_data.get("isPublic", "true").lower() == "true"
        publish_type = form_data.get("publishType", "immediate")
        scheduled_publish_at_str = form_data.get("scheduledPublishAt", "")
        # Fallback para campos antigos (scheduleDate e scheduleTime)
        schedule_date = form_data.get("scheduleDate", "")
        schedule_time = form_data.get("scheduleTime", "")
        print(f"[UPLOAD] publish_type: {publish_type}, scheduled_publish_at: {scheduled_publish_at_str}")
        release_date = form_data.get("releaseDate")
        custom_url = form_data.get("customUrl", "").lower().replace(" ", "-") if form_data.get("customUrl") else None
        youtube_url = form_data.get("youtubeUrl")
        song_metadata_str = form_data.get("songMetadata", "{}")
        collaborators_str = form_data.get("collaborators", "[]")
        artist_id = form_data.get("artistId")
        artist_name = form_data.get("artistName", "")
        auth_header = request.headers.get("Authorization")
        
        # Get files
        cover_image_file = form_data.get("coverImage")
        album_file = form_data.get("albumFile")
        
        if not album_file:
            raise HTTPException(status_code=400, detail="albumFile is required")
        
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
        
        # Use uploadId from frontend if provided, otherwise generate new one
        upload_id = form_data.get("uploadId") or str(uuid.uuid4())
        print(f"[UPLOAD] Upload ID: {upload_id}")
        
        # Initialize progress tracking (update_progress will handle initialization)
        progress_module.update_progress(upload_id, 0, "iniciando_upload")
        
        # Skip connection test - upload will fail directly if there's an issue
        print(f"[UPLOAD] Supabase connection configured.")
        progress_module.update_progress(upload_id, 5, "conexao_verificada")
        
        # Create working directory
        temp_dir = Path(__file__).parent.parent / "uploads" / upload_id
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        try:
            progress_module.update_progress(upload_id, 1, "lendo_arquivo")
            await asyncio.sleep(0.1)
            print(f"[UPLOAD] Starting file processing...")
            
            # Save and extract ZIP file
            album_zip_path = temp_dir / f"{album_file.filename}"
            print(f"[UPLOAD] Reading file contents...")
            progress_module.update_progress(upload_id, 5, "extraindo_arquivo")
            await asyncio.sleep(0.1)
            contents = await album_file.read()
            
            print(f"[UPLOAD] Writing file to disk...")
            with open(album_zip_path, "wb") as f:
                f.write(contents)
            
            print(f"[UPLOAD] File saved: {album_zip_path}")
            print(f"[UPLOAD] File size: {os.path.getsize(album_zip_path)} bytes")
            
            # Extract archive
            extract_dir = temp_dir / "extracted"
            extract_dir.mkdir(exist_ok=True)
            
            file_extension = album_zip_path.suffix.lower()
            
            try:
                if file_extension == '.zip':
                    print(f"[UPLOAD] Extracting ZIP file...")
                    progress_module.update_progress(upload_id, 15, "extraindo_zip")
                    await asyncio.sleep(0.1)
                    with zipfile.ZipFile(album_zip_path, 'r') as zip_ref:
                        zip_ref.extractall(extract_dir)
                    print(f"[UPLOAD] ZIP extracted successfully to: {extract_dir}")
                    progress_module.update_progress(upload_id, 32, "zip_extraido")
                    await asyncio.sleep(0.1)
                elif file_extension == '.rar':
                    print(f"[UPLOAD] Extracting RAR file (this may take a while)...")
                    try:
                        # Try using rarfile library with proper error handling
                        rarfile.RarFile.strerror = True  # Better error messages
                        progress_module.update_progress(upload_id, 20, "extraindo_rar")
                        with rarfile.RarFile(album_zip_path) as rar_ref:
                            # Verify RAR file is readable
                            infolist = rar_ref.infolist()
                            print(f"[UPLOAD] RAR file contains {len(infolist)} items")
                            
                            # Extract all files
                            rar_ref.extractall(extract_dir)
                            print(f"[UPLOAD] RAR extracted successfully to: {extract_dir}")
                            progress_module.update_progress(upload_id, 35, "rar_extraido")
                    except rarfile.Error as e:
                        print(f"[UPLOAD] RAR extraction error (rarfile): {e}")
                        # Fallback: try command-line unrar if available
                        import subprocess
                        try:
                            print(f"[UPLOAD] Trying command-line unrar as fallback...")
                            result = subprocess.run(
                                ['unrar', 'x', '-o+', str(album_zip_path), str(extract_dir)],
                                capture_output=True,
                                text=True,
                                timeout=300
                            )
                            if result.returncode != 0:
                                raise Exception(f"unrar failed: {result.stderr}")
                            print(f"[UPLOAD] RAR extracted successfully via command-line")
                        except Exception as unrar_err:
                            print(f"[UPLOAD] Command-line unrar also failed: {unrar_err}")
                            raise Exception(f"Failed to extract RAR file: {e}. Fallback error: {unrar_err}")
                else:
                    raise HTTPException(status_code=400, detail="Unsupported file format. Please use ZIP or RAR.")
            except zipfile.BadZipFile as e:
                print(f"Bad ZIP file: {e}")
                raise HTTPException(status_code=400, detail="ZIP file is corrupted or invalid")
            except rarfile.BadRarFile as e:
                print(f"Bad RAR file: {e}")
                raise HTTPException(status_code=400, detail="RAR file is corrupted or invalid")
            except Exception as e:
                import traceback
                print(f"Error extracting archive: {e}")
                print(f"Traceback: {traceback.format_exc()}")
                raise HTTPException(status_code=400, detail=f"Error extracting archive: {str(e)}")
            
            print(f"[UPLOAD] Listing extracted files...")
            # List all files in extracted directory
            all_files = list(extract_dir.rglob("*"))
            print(f"[UPLOAD] Total items found: {len(all_files)}")
            for i, f in enumerate(all_files[:50]):
                print(f"[UPLOAD]   {i+1}. {f.name} ({f.suffix})")
            
            # Find all MP3 files (case-insensitive)
            print(f"[UPLOAD] Searching for MP3 files...")
            mp3_files = []
            for file_path in all_files:
                if file_path.is_file():
                    if file_path.suffix.lower() in ['.mp3', '.m4a', '.wav', '.flac', '.ogg']:
                        mp3_files.append(file_path)
                        print(f"[UPLOAD]   Found audio file: {file_path.name}")
            
            print(f"[UPLOAD] Found {len(mp3_files)} audio files")
            progress_module.update_progress(upload_id, 35, "arquivos_encontrados")
            await asyncio.sleep(0.1)
            
            if not mp3_files:
                print(f"WARNING: No audio files found in archive!")
                progress_module.update_progress(upload_id, 0, "erro_nenhum_audio")
                raise HTTPException(status_code=400, detail="Nenhum arquivo de áudio (MP3, M4A, WAV, FLAC, OGG) encontrado no arquivo. Verifique o conteúdo do ZIP/RAR.")
            
            # Parse metadata
            try:
                song_metadata = json.loads(song_metadata_str)
                collaborator_ids = json.loads(collaborators_str) if collaborators_str else []
                tags = json.loads(tags_str) if tags_str else []
            except Exception as e:
                print(f"Error parsing metadata: {e}")
                song_metadata = {}
                collaborator_ids = []
                tags = []
            
            # Store cover data temporarily (will upload after album is created)
            cover_data = None
            cover_file_ext = None
            if cover_image_file:
                try:
                    cover_data = await cover_image_file.read()
                    cover_file_ext = cover_image_file.filename.lower().split('.')[-1]
                    print(f"[UPLOAD] Cover image read: {len(cover_data)} bytes")
                except Exception as e:
                    print(f"[UPLOAD] Error reading cover: {e}")
            
            # Create album record in Supabase
            # Generate unique slug: if custom_url provided use it, otherwise use title + uuid suffix
            if custom_url:
                album_slug = custom_url
            else:
                base_slug = title.lower().replace(" ", "-").replace(".", "").replace(",", "")[:50]
                # Add short uuid to ensure uniqueness
                slug_suffix = str(uuid.uuid4())[:8]
                album_slug = f"{base_slug}-{slug_suffix}"
            
            # Handle scheduled publishing
            is_scheduled = publish_type == "scheduled"
            scheduled_publish_at = None
            should_publish_now = False  # Flag para publicar imediatamente
            
            if is_scheduled:
                # Usar o novo formato (scheduledPublishAt como ISO string)
                if scheduled_publish_at_str:
                    # Remover .000Z ou .xxxZ e manter só o que precisa
                    # Frontend envia: "2025-12-18T05:00:00.000Z"
                    # Converter para: "2025-12-18T05:00:00+00:00" (formato PostgreSQL)
                    if scheduled_publish_at_str.endswith('Z'):
                        # Remover Z e adicionar +00:00
                        base_datetime = scheduled_publish_at_str[:-1]  # Remove Z
                        # Se tem milissegundos, remover
                        if '.' in base_datetime:
                            base_datetime = base_datetime.split('.')[0]
                        scheduled_publish_at = f"{base_datetime}+00:00"
                    else:
                        scheduled_publish_at = scheduled_publish_at_str
                    
                    # Verificar se a data de agendamento já passou
                    from datetime import datetime, timezone
                    now = datetime.now(timezone.utc)
                    scheduled_date = datetime.fromisoformat(scheduled_publish_at.replace('+00:00', '+00:00'))
                    
                    if scheduled_date <= now:
                        print(f"[UPLOAD] Data de agendamento ({scheduled_publish_at}) já passou. Publicando imediatamente!")
                        should_publish_now = True
                        is_scheduled = False  # Não marcar como agendado
                    else:
                        print(f"[UPLOAD] Album scheduled for: {scheduled_publish_at}")
                elif schedule_date and schedule_time:
                    # Fallback para campos antigos
                    scheduled_publish_at = f"{schedule_date}T{schedule_time}:00Z"
                    print(f"[UPLOAD] Album scheduled for (fallback): {scheduled_publish_at}")
            
            album_data = {
                "title": title,
                "description": description,
                "genre": genre,
                "tags": tags,
                "slug": album_slug,
                "artist_id": user_id,
                "artist_name": artist_name,
                "cover_url": None,  # Will be updated after cover upload
                "is_private": False if should_publish_now else (is_scheduled or (not is_public)),  # Público se should_publish_now, senão segue a regra normal
                "is_scheduled": True if is_scheduled else False,  # Explicitly ensure boolean
                "scheduled_publish_at": scheduled_publish_at if is_scheduled else None,  # Limpar se não é mais agendado
                "release_date": release_date,  # Salvar a data completa
                "release_year": release_date[:4] if release_date else None
            }
            
            # Insert album
            progress_module.update_progress(upload_id, 80, "criando_album")
            print(f"[UPLOAD] Inserting album into database...")
            print(f"[UPLOAD] Album data: {album_data}")
            album_response = supabase.table("albums").insert(album_data).execute()
            
            print(f"[UPLOAD] Album response: {album_response}")
            print(f"[UPLOAD] Album response data: {album_response.data if hasattr(album_response, 'data') else 'No data attribute'}")
            
            if not hasattr(album_response, 'data') or not album_response.data or len(album_response.data) == 0:
                raise HTTPException(status_code=500, detail="Failed to create album in database")
            
            album_record = album_response.data[0]
            album_id = album_record.get("id") if isinstance(album_record, dict) else None
            
            if not album_id:
                raise HTTPException(status_code=500, detail="Failed to get album ID from response")
            
            print(f"Album created with ID: {album_id}")
            
            # Now upload cover image to Supabase Storage with correct album_id
            cover_url = None
            if cover_data:
                try:
                    # Sanitize user_id and album_id in path
                    safe_user_id = sanitize_filename(str(user_id))
                    safe_album_id = sanitize_filename(str(album_id))
                    cover_filename = f"albums/{safe_user_id}/{safe_album_id}/cover.jpg"
                    
                    # Determine MIME type based on file extension
                    mime_types = {
                        'jpg': 'image/jpeg',
                        'jpeg': 'image/jpeg',
                        'png': 'image/png',
                        'gif': 'image/gif',
                        'webp': 'image/webp'
                    }
                    mime_type = mime_types.get(cover_file_ext, 'image/jpeg')
                    
                    # Use httpx directly with proper headers
                    async with httpx.AsyncClient() as client:
                        upload_url = f"{SUPABASE_URL}/storage/v1/object/public/musica/{cover_filename}"
                        headers = {
                            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                            "Content-Type": mime_type
                        }
                        response = await client.post(upload_url, content=cover_data, headers=headers)
                        if response.status_code not in [200, 201]:
                            print(f"[UPLOAD] Cover upload error: {response.text}")
                        else:
                            cover_url = f"{SUPABASE_URL}/storage/v1/object/public/musica/{cover_filename}"
                            print(f"[UPLOAD] Cover uploaded: {cover_url}")
                            
                            # Update album with cover URL
                            supabase.table("albums").update({
                                "cover_url": cover_url
                            }).eq("id", album_id).execute()
                            print(f"[UPLOAD] Album updated with cover URL")
                except Exception as e:
                    print(f"[UPLOAD] Error uploading cover: {e}")
            
            # Upload MP3 files and create song records
            progress_module.update_progress(upload_id, 40, "iniciando_upload_musicas")
            await asyncio.sleep(0.1)
            songs_created = []
            total_songs = len(mp3_files)
            for idx, mp3_file in enumerate(sorted(mp3_files), 1):
                try:
                    # Calculate progress: 40-80% for uploads
                    song_progress = 40 + int((idx / max(total_songs, 1)) * 35)  # 40-75% for uploads
                    print(f"[UPLOAD] Processing song {idx}/{total_songs}: {mp3_file.name}")
                    progress_module.update_progress(upload_id, song_progress, f"enviando_musica_{idx}")
                    await asyncio.sleep(0.05)
                    
                    # Read MP3 file
                    with open(mp3_file, "rb") as f:
                        mp3_data = f.read()
                    
                    print(f"[UPLOAD] Read {len(mp3_data)} bytes for {mp3_file.name}")
                    
                    # Clean filename - remove duplicate extensions
                    clean_filename = mp3_file.stem  # Remove .mp3 if duplicated
                    if clean_filename.endswith('.mp3'):
                        clean_filename = clean_filename[:-4]  # Remove another .mp3 if it exists
                    
                    # Sanitize for Supabase (remove accents and special chars)
                    clean_filename = sanitize_filename(clean_filename)
                    clean_filename = f"{clean_filename}.mp3"
                    
                    # Upload to Supabase Storage
                    # Sanitize album_id in path
                    safe_album_id = sanitize_filename(str(album_id))
                    storage_path = f"songs/{safe_album_id}/{idx:02d}_{clean_filename}"
                    print(f"[UPLOAD] Uploading to: {storage_path}")
                    
                    # Use httpx directly with proper headers for MP3 - with retry logic
                    upload_success = False
                    max_retries = 3
                    
                    for attempt in range(max_retries):
                        try:
                            progress_module.update_progress(upload_id, song_progress, f"enviando_musica_{idx}_tentativa_{attempt+1}")
                            await asyncio.sleep(0.05)
                            async with httpx.AsyncClient(timeout=60.0) as client:
                                upload_url = f"{SUPABASE_URL}/storage/v1/object/public/musica/{storage_path}"
                                headers = {
                                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                                    "Content-Type": "audio/mpeg"
                                }
                                response = await client.post(upload_url, content=mp3_data, headers=headers)
                                if response.status_code not in [200, 201]:
                                    print(f"[UPLOAD] Upload error (attempt {attempt+1}/{max_retries}): {response.status_code} - {response.text}")
                                    if attempt < max_retries - 1:
                                        await asyncio.sleep(2 ** attempt)  # Exponential backoff
                                        continue
                                    raise Exception(f"Upload failed after {max_retries} attempts: {response.text}")
                                print(f"[UPLOAD] Upload successful: {response.status_code}")
                                upload_success = True
                                break
                        except asyncio.TimeoutError:
                            print(f"[UPLOAD] Upload timeout (attempt {attempt+1}/{max_retries})")
                            if attempt < max_retries - 1:
                                await asyncio.sleep(2 ** attempt)
                                continue
                            raise Exception(f"Upload timeout after {max_retries} attempts")
                    
                    if not upload_success:
                        raise Exception(f"Failed to upload song {idx}")
                    
                    # Update progress after successful song upload
                    progress_module.update_progress(upload_id, song_progress + 1, f"musica_{idx}_concluida")
                    await asyncio.sleep(0.05)
                    
                    # Get public URL
                    audio_url = f"{SUPABASE_URL}/storage/v1/object/public/musica/{storage_path}"
                    print(f"[UPLOAD] Audio URL: {audio_url}")
                    
                    # Create song record
                    song_data = {
                        "title": mp3_file.stem,
                        "album_id": album_id,
                        "artist_id": user_id,
                        "artist_name": artist_name,
                        "album_name": title,
                        "audio_url": audio_url,
                        "cover_url": cover_url,
                        "duration": 0,  # TODO: Extract duration from MP3
                        "track_number": idx
                    }
                    
                    print(f"[UPLOAD] Inserting song record: {song_data}")
                    song_response = supabase.table("songs").insert(song_data).execute()
                    
                    if hasattr(song_response, 'data') and song_response.data and len(song_response.data) > 0:
                        songs_created.append(song_response.data[0])
                        print(f"[UPLOAD] Song {idx} created with ID: {song_response.data[0].get('id')}")
                    else:
                        print(f"[UPLOAD] Warning: Song {idx} response had no data: {song_response}")
                    
                    # Update progress after recording
                    progress_module.update_progress(upload_id, song_progress + 2, f"musica_{idx}_registrada")
                    await asyncio.sleep(0.05)
                    
                    print(f"[UPLOAD] Song {idx} uploaded: {mp3_file.name}")
                    
                except Exception as e:
                    import traceback
                    print(f"[UPLOAD] Error uploading song {idx}: {e}")
                    print(f"[UPLOAD] Traceback: {traceback.format_exc()}")
                    continue
            
            print(f"Created {len(songs_created)} song records")
            
            # Update album with song count
            progress_module.update_progress(upload_id, 75, "atualizando_contagem_musicas")
            await asyncio.sleep(0.1)
            print(f"[UPLOAD] Updating album song count to {len(songs_created)}")
            try:
                update_response = supabase.table("albums").update({
                    "song_count": len(songs_created)
                }).eq("id", album_id).execute()
                print(f"[UPLOAD] Update response: {update_response}")
                print(f"[UPLOAD] Update data: {update_response.data if hasattr(update_response, 'data') else 'No data'}")
                print(f"[UPLOAD] Album successfully updated with song count: {len(songs_created)}")
                progress_module.update_progress(upload_id, 80, "contagem_atualizada")
                await asyncio.sleep(0.1)
            except Exception as e:
                import traceback
                print(f"[UPLOAD] Error updating song count: {e}")
                print(traceback.format_exc())
            
            # Mark as complete
            progress_module.update_progress(upload_id, 90, "finalizando")
            await asyncio.sleep(0.1)
            progress_module.update_progress(upload_id, 100, "concluido")
            await asyncio.sleep(0.05)
            progress_module.complete_progress(upload_id)
            
            return {
                "success": True,
                "upload_id": upload_id,
                "album": {
                    "id": album_id,
                    "title": title,
                    "slug": album_slug,
                    "cover_url": cover_url,
                    "songs_count": len(songs_created)
                },
                "message": f"Album uploaded successfully with {len(songs_created)} songs"
            }
            
        except HTTPException:
            raise
        except Exception as e:
            import traceback
            print(f"Error processing upload: {str(e)}")
            print(traceback.format_exc())
            raise HTTPException(status_code=500, detail=f"Error processing upload: {str(e)}")
        
        finally:
            # Cleanup temp directory
            if temp_dir.exists():
                shutil.rmtree(temp_dir)
                print(f"Cleaned up temp directory: {temp_dir}")
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error uploading album: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error uploading album: {str(e)}")
