-- Migration: Adicionar campo allow_download na tabela albums
-- Execute este script no SQL Editor do Supabase

-- Adicionar coluna allow_download (padrão: true = download permitido)
ALTER TABLE public.albums 
ADD COLUMN IF NOT EXISTS allow_download BOOLEAN NOT NULL DEFAULT TRUE;

-- Comentário explicativo
COMMENT ON COLUMN public.albums.allow_download IS 
'Se TRUE, o download do álbum é permitido no site web e no app. 
Se FALSE, o download só é permitido no app mobile para ouvir offline — 
o site web não disponibiliza o arquivo MP3 para download.';

-- Verificar resultado
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'albums' AND column_name = 'allow_download';
