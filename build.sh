#!/bin/bash
set -e

echo "🔨 Iniciando build..."
cd frontend
echo "🏗️ Compilando frontend..."
FAST_REFRESH=false NODE_ENV=production CI=false npm run build
cd ..

echo "📁 Preparando pasta de distribuição..."
rm -rf build
mkdir -p build
echo "📋 Copiando arquivos compilados..."
cp -r frontend/build/* build/

echo "✅ Build concluído com sucesso!"
ls -la build/ | head -10
