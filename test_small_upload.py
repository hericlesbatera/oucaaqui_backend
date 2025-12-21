#!/usr/bin/env python3
# Test small upload to Supabase
import os
import io
import zipfile
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Criar um ZIP pequeno de teste
zip_buffer = io.BytesIO()
with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
    zip_file.writestr('test.txt', 'Hello World' * 100)

zip_buffer.seek(0)
content = zip_buffer.getvalue()

print(f"Test ZIP size: {len(content) / 1024:.1f}KB")

try:
    print("Uploading...", end='', flush=True)
    path = f"test/test_{os.getpid()}.zip"
    supabase.storage.from_('musica').upload(path, content, {"contentType": "application/zip"})
    print(" [OK]")
    
    url = supabase.storage.from_('musica').get_public_url(path)
    print(f"URL: {url}")
except Exception as e:
    print(f" [ERROR: {e}]")
