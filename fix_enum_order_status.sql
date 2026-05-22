-- ============================================================
-- fix_enum_order_status.sql  (versión COMPLETA)
-- Agrega TODOS los valores del enum order_status
-- IF NOT EXISTS evita error si ya existen algunos
-- Ejecuta esto en el SQL Editor de Supabase
-- ============================================================

ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'Pendiente';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'Listo para Despacho';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'Asignado';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'En ruta';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'Entregado';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'Incidencia';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'Cancelado';
