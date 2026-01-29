-- Corrigir RLS para tabela 'favorites'
-- Execute isso no SQL Editor do Supabase

-- 1. Habilitar RLS na tabela favorites
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- 2. Permitir que usuários vejam seus próprios favoritos
CREATE POLICY "Users can view their own favorites"
ON public.favorites
FOR SELECT
USING (auth.uid() = user_id);

-- 3. Permitir que usuários inserem seus próprios favoritos
CREATE POLICY "Users can insert their own favorites"
ON public.favorites
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 4. Permitir que usuários deletem seus próprios favoritos
CREATE POLICY "Users can delete their own favorites"
ON public.favorites
FOR DELETE
USING (auth.uid() = user_id);

-- 5. Permitir que admin veja todos (opcional)
CREATE POLICY "Admin can view all favorites"
ON public.favorites
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);
