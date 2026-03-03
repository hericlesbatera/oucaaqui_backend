"""
Scheduler para:
1. Publicação automática de álbuns agendados.
2. Exclusão permanente automática de álbuns na lixeira há mais de 30 dias,
   incluindo remoção dos arquivos do Storage do Supabase (capa + MP3s).
"""

import asyncio
import os
import httpx
from datetime import datetime, timezone, timedelta
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

_scheduler_running = False


async def publish_scheduled_albums():
    """
    Verifica e publica álbuns agendados cujo horário já chegou.
    """
    try:
        now = datetime.now(timezone.utc).isoformat()
        print(f"[SCHEDULER] Verificando álbuns agendados... ({now})")

        # Buscar álbuns agendados com data <= agora
        response = supabase.table("albums") \
            .select("id, title, scheduled_publish_at") \
            .eq("is_scheduled", True) \
            .lte("scheduled_publish_at", now) \
            .execute()

        albums = response.data if response.data else []

        if not albums:
            print(f"[SCHEDULER] Nenhum álbum para publicar.")
            return

        print(f"[SCHEDULER] {len(albums)} álbum(ns) prontos para publicação!")

        published_at = datetime.now(timezone.utc).isoformat()

        for album in albums:
            album_id = album["id"]
            album_title = album["title"]
            try:
                supabase.table("albums").update({
                    "is_scheduled": False,
                    "is_private": False,
                    "published_at": published_at
                }).eq("id", album_id).execute()

                print(f"[SCHEDULER] ✅ Álbum publicado: '{album_title}' (ID: {album_id})")

            except Exception as e:
                print(f"[SCHEDULER] ❌ Erro ao publicar álbum '{album_title}' (ID: {album_id}): {e}")

    except Exception as e:
        print(f"[SCHEDULER] ❌ Erro geral no scheduler de publicação: {e}")
        import traceback
        traceback.print_exc()


async def delete_storage_files(album_id: str, album_slug: str):
    """
    Remove os arquivos do Storage do Supabase para um álbum:
    - Capa: albums/{slug}/cover.jpg
    - Áudios: songs/{album_id}/xx_nome.mp3
    """
    try:
        # Buscar as músicas para obter os paths de áudio
        songs_response = supabase.table("songs") \
            .select("id, audio_url") \
            .eq("album_id", album_id) \
            .execute()

        songs = songs_response.data if songs_response.data else []

        # Extrair paths relativos dos áudios
        audio_paths = []
        for song in songs:
            audio_url = song.get("audio_url", "")
            if audio_url:
                # URL: .../storage/v1/object/public/musica/songs/{albumId}/xx_nome.mp3
                import re
                match = re.search(r'/musica/(.+)$', audio_url)
                if match:
                    audio_paths.append(match.group(1))

        # Remover áudios do Storage
        if audio_paths:
            result = supabase.storage.from_("musica").remove(audio_paths)
            print(f"[SCHEDULER] 🗑 Áudios removidos do Storage ({len(audio_paths)} arquivos) para álbum {album_id}")

        # Remover capa do Storage
        if album_slug:
            cover_path = f"albums/{album_slug}/cover.jpg"
            result = supabase.storage.from_("musica").remove([cover_path])
            print(f"[SCHEDULER] 🗑 Capa removida do Storage: {cover_path}")

    except Exception as e:
        print(f"[SCHEDULER] ⚠ Erro ao remover arquivos do Storage para álbum {album_id}: {e}")
        import traceback
        traceback.print_exc()


async def cleanup_expired_trash():
    """
    Exclui permanentemente álbuns na lixeira há mais de 30 dias,
    removendo também os arquivos do Storage (capa + MP3s).
    """
    try:
        # Calcular data limite: 30 dias atrás
        cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        print(f"[SCHEDULER] Verificando lixeira expirada (deleted_at <= {cutoff})...")

        # Buscar álbuns na lixeira há mais de 30 dias
        response = supabase.table("albums") \
            .select("id, title, slug") \
            .not_.is_("deleted_at", "null") \
            .lte("deleted_at", cutoff) \
            .execute()

        albums = response.data if response.data else []

        if not albums:
            print(f"[SCHEDULER] Nenhum álbum expirado na lixeira.")
            return

        print(f"[SCHEDULER] {len(albums)} álbum(ns) expirado(s) para exclusão permanente!")

        for album in albums:
            album_id = album["id"]
            album_title = album["title"]
            album_slug = album.get("slug", "")

            try:
                print(f"[SCHEDULER] Excluindo permanentemente: '{album_title}' (ID: {album_id})")

                # 1. Remover arquivos do Storage
                await delete_storage_files(album_id, album_slug)

                # 2. Deletar músicas do banco
                supabase.table("songs").delete().eq("album_id", album_id).execute()

                # 3. Deletar vídeos associados
                supabase.table("artist_videos").delete().eq("album_id", album_id).execute()

                # 4. Deletar o álbum do banco
                supabase.table("albums").delete().eq("id", album_id).execute()

                print(f"[SCHEDULER] ✅ Álbum excluído permanentemente: '{album_title}' (ID: {album_id})")

            except Exception as e:
                print(f"[SCHEDULER] ❌ Erro ao excluir álbum '{album_title}' (ID: {album_id}): {e}")

    except Exception as e:
        print(f"[SCHEDULER] ❌ Erro geral no scheduler de lixeira: {e}")
        import traceback
        traceback.print_exc()


async def run_scheduler():
    """
    Loop principal do scheduler — roda a cada 60 segundos.
    """
    global _scheduler_running
    if _scheduler_running:
        print("[SCHEDULER] Scheduler já está rodando, ignorando nova instância.")
        return

    _scheduler_running = True
    print("[SCHEDULER] ▶ Scheduler iniciado — verificando a cada 60 segundos.")

    while True:
        try:
            await publish_scheduled_albums()
            await cleanup_expired_trash()
        except Exception as e:
            print(f"[SCHEDULER] Erro inesperado: {e}")
        await asyncio.sleep(60)


def start_scheduler():
    """
    Inicia o scheduler em background como task asyncio.
    Deve ser chamado no startup do FastAPI.
    """
    loop = asyncio.get_event_loop()
    loop.create_task(run_scheduler())
    print("[SCHEDULER] Task de scheduler criada.")
