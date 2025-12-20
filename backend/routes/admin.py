from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import subprocess
import io
import sys

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.post("/generate-archives")
async def generate_archives():
    """
    Executa o script generate_album_archives.py em background
    e retorna o output em streaming
    """
    try:
        def generate_output():
            try:
                # Executar script e capturar output
                process = subprocess.Popen(
                    [sys.executable, "generate_album_archives.py"],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1
                )
                
                # Enviar output linha por linha
                for line in process.stdout:
                    yield line.encode() + b'\n'
                
                process.wait()
                
                if process.returncode != 0:
                    yield f"Erro: processo retornou código {process.returncode}".encode()
                else:
                    yield b"Processo concluído com sucesso!\n"
            
            except Exception as e:
                yield f"Erro ao executar script: {str(e)}".encode()
        
        return StreamingResponse(generate_output(), media_type="text/plain")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar archives: {str(e)}")
