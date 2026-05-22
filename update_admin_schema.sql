-- ============================================================
-- update_admin_schema.sql
-- Ejecuta esto en el SQL Editor de Supabase
-- ============================================================

-- 1. Soft Delete: Agregar columna 'activo' en tabla cliente
ALTER TABLE public.cliente ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true;

-- 2. Enum: Agregar rol 'Administrador' si no existe
-- (Si el enum ya tiene 'Administrador', este bloque no hace nada malo)
DO $$ BEGIN
  ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'Administrador';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Políticas RLS para Administrador
-- Pedido: full control
DROP POLICY IF EXISTS "Admin_All_Pedido" ON public.pedido;
CREATE POLICY "Admin_All_Pedido" ON public.pedido FOR ALL TO authenticated USING (
    (SELECT rol FROM public.usuario WHERE id = auth.uid()) = 'Administrador'
) WITH CHECK (
    (SELECT rol FROM public.usuario WHERE id = auth.uid()) = 'Administrador'
);

-- Usuario: update y select
DROP POLICY IF EXISTS "Admin_Update_Usuario" ON public.usuario;
CREATE POLICY "Admin_Update_Usuario" ON public.usuario FOR UPDATE TO authenticated USING (
    (SELECT rol FROM public.usuario WHERE id = auth.uid()) = 'Administrador'
);

-- Cliente: full control
DROP POLICY IF EXISTS "Admin_All_Cliente" ON public.cliente;
CREATE POLICY "Admin_All_Cliente" ON public.cliente FOR ALL TO authenticated USING (
    (SELECT rol FROM public.usuario WHERE id = auth.uid()) = 'Administrador'
) WITH CHECK (
    (SELECT rol FROM public.usuario WHERE id = auth.uid()) = 'Administrador'
);

-- Producto: full control
DROP POLICY IF EXISTS "Admin_All_Producto" ON public.producto;
CREATE POLICY "Admin_All_Producto" ON public.producto FOR ALL TO authenticated USING (
    (SELECT rol FROM public.usuario WHERE id = auth.uid()) = 'Administrador'
) WITH CHECK (
    (SELECT rol FROM public.usuario WHERE id = auth.uid()) = 'Administrador'
);

-- Incidencia: read para admin
DROP POLICY IF EXISTS "Admin_Select_Incidencia" ON public.incidencia;
CREATE POLICY "Admin_Select_Incidencia" ON public.incidencia FOR SELECT TO authenticated USING (
    (SELECT rol FROM public.usuario WHERE id = auth.uid()) = 'Administrador'
);

-- 4. Asegurar que Realtime esté habilitado para tablas clave
ALTER PUBLICATION supabase_realtime ADD TABLE public.usuario;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cliente;
ALTER PUBLICATION supabase_realtime ADD TABLE public.producto;
