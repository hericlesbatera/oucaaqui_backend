from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
import subprocess
import sys
import threading

router = APIRouter(prefix="/api/admin", tags=["admin"])

# Controlar se está executando
is_generating = False
generation_output = []


def run_generation_script():
    """Executa o script em uma thread separada"""
    global is_generating, generation_output
    
    try:
        is_generating = True
        generation_output = []
        
        # Executar script
        process = subprocess.Popen(
            [sys.executable, "generate_album_archives.py"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            cwd="/app" if "/app" in sys.executable else None
        )
        
        # Capturar output
        while True:
            line = process.stdout.readline()
            if not line:
                break
            generation_output.append(line.strip())
            print(line.strip())
        
        process.wait()
        generation_output.append(f"[CONCLUÍDO] Código de retorno: {process.returncode}")
        
    except Exception as e:
        generation_output.append(f"[ERRO] {str(e)}")
    finally:
        is_generating = False


@router.post("/generate-archives")
async def generate_archives():
    """
    Inicia a geração dos ZIPs em background
    Retorna status + lista de output anterior
    """
    global is_generating
    
    if is_generating:
        return JSONResponse({
            "status": "em_progresso",
            "message": "Geração já em andamento",
            "output": generation_output[-20:]  # Últimas 20 linhas
        })
    
    # Iniciar em thread separada
    thread = threading.Thread(target=run_generation_script, daemon=True)
    thread.start()
    
    return JSONResponse({
        "status": "iniciado",
        "message": "Geração de archives iniciada em background",
        "output": ["Verifique novamente em alguns minutos..."]
    })


@router.get("/generate-archives/status")
async def get_generation_status():
    """Retorna status atual da geração"""
    global is_generating, generation_output
    
    return JSONResponse({
        "is_generating": is_generating,
        "total_lines": len(generation_output),
        "output": generation_output[-50:]  # Últimas 50 linhas
    })
