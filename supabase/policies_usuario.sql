-- Script para asegurar la seguridad en la tabla public.usuario

-- 1. Habilitar RLS
ALTER TABLE public.usuario ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas previas si existen (para evitar duplicados)
DROP POLICY IF EXISTS "Admins can do everything" ON public.usuario;
DROP POLICY IF EXISTS "Users can read their own profile" ON public.usuario;

-- 3. Política: Los administradores tienen acceso total
CREATE POLICY "Admins can do everything"
ON public.usuario
FOR ALL
TO authenticated
USING (
  (SELECT rol FROM public.usuario WHERE id = auth.uid()) = 'Administrador'
);

-- 4. Política: Todos los usuarios autenticados pueden ver los perfiles (necesario para selects en el dashboard)
CREATE POLICY "Public read access for authenticated"
ON public.usuario
FOR SELECT
TO authenticated
USING (true);

-- Nota: El Service Role (usado por Edge Functions) siempre ignora RLS.
-- Este script protege la tabla de accesos directos desde el cliente malintencionados.
