"""
Script para diagnosticar e corrigir álbuns agendados no banco de dados.
Execute isso para verificar e corrigir os dados.
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

# 1. Listar todos os álbuns para diagnosticar
print("=" * 80)
print("DIAGNOSTICANDO E CORRIGINDO ÁLBUNS NO BANCO DE DADOS")
print("=" * 80)

try:
    response = supabase.table("albums").select("id, title, is_scheduled, scheduled_publish_at, is_private, created_at").execute()
    
    if response.data:
        print(f"\nTotal de álbuns: {len(response.data)}\n")
        
        scheduled_count = 0
        needs_fix_count = 0
        
        for album in response.data:
            is_scheduled = album.get("is_scheduled")
            scheduled_date = album.get("scheduled_publish_at")
            
            # Diagnosticar problemas
            needs_fix = False
            if scheduled_date and not is_scheduled:
                needs_fix = True
                needs_fix_count += 1
            
            print(f"Álbum: {album['title']}")
            print(f"  ID: {album['id']}")
            print(f"  is_scheduled: {is_scheduled} (tipo: {type(is_scheduled).__name__})")
            print(f"  scheduled_publish_at: {scheduled_date}")
            print(f"  is_private: {album.get('is_private')}")
            
            if needs_fix:
                print(f"  ⚠️  PRECISA CORREÇÃO: tem data agendada mas is_scheduled não está true")
            elif is_scheduled:
                scheduled_count += 1
                print(f"  ✓ OK - Álbum agendado corretamente")
            
            print()
        
        print("=" * 80)
        print(f"Álbuns agendados: {scheduled_count}")
        print(f"Álbuns que precisam correção: {needs_fix_count}")
        print("=" * 80)
        
        # 2. Corrigir álbuns agendados com dados inconsistentes
        if needs_fix_count > 0:
            print(f"\nCORRIGINDO {needs_fix_count} ÁLBUM(NS)...\n")
            
            fixed_count = 0
            for album in response.data:
                if album.get("scheduled_publish_at") and not album.get("is_scheduled"):
                    # Se tem data agendada mas is_scheduled é null/false, corrigir
                    print(f"Corrigindo: {album['title']}")
                    print(f"  Definindo is_scheduled = true")
                    
                    try:
                        update_response = supabase.table("albums").update({
                            "is_scheduled": True
                        }).eq("id", album["id"]).execute()
                        
                        print(f"  ✓ Atualizado com sucesso!\n")
                        fixed_count += 1
                    except Exception as e:
                        print(f"  ✗ Erro ao atualizar: {e}\n")
            
            print("=" * 80)
            print(f"Total corrigido: {fixed_count}/{needs_fix_count}")
            print("=" * 80)
        else:
            print("\n✓ Nenhuma correção necessária! Todos os álbuns estão corretos.")
    else:
        print("Nenhum álbum encontrado no banco de dados")
        
except Exception as e:
    print(f"Erro ao diagnosticar: {e}")
    import traceback
    traceback.print_exc()
