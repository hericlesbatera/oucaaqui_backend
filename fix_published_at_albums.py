"""
Script para preencher o campo published_at em álbuns antigos
que estão publicados, mas sem published_at (para aparecerem na Home).
"""
from supabase import create_client
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

print("Buscando álbuns publicados sem published_at...")
albums = supabase.table("albums").select("id, created_at, published_at, is_private, is_scheduled").is_("published_at", None).eq("is_private", False).eq("is_scheduled", False).execute()

if not albums.data:
    print("Nenhum álbum antigo encontrado para corrigir!")
    exit(0)

print(f"Encontrados {len(albums.data)} álbuns para corrigir.")

for album in albums.data:
    album_id = album["id"]
    created_at = album.get("created_at")
    # Use a data de criação como published_at, ou a data/hora atual se preferir
    published_at = created_at or datetime.utcnow().isoformat()
    print(f"Atualizando álbum {album_id} ... published_at = {published_at}")
    supabase.table("albums").update({"published_at": published_at}).eq("id", album_id).execute()

print("Correção concluída! Todos os álbuns antigos agora têm published_at.")
