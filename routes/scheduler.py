"""
Scheduler para publicação automática de álbuns agendados.
Verifica a cada minuto se há álbuns com scheduled_publish_at <= agora
e os publica automaticamente (is_scheduled = False, is_private = False, published_at = agora).
"""

import asyncio
import os
from datetime import datetime, timezone
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
            .eq("is_deleted", False) \
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
        print(f"[SCHEDULER] ❌ Erro geral no scheduler: {e}")
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
