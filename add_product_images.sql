-- ============================================================
-- add_product_images.sql
-- Agrega soporte para imágenes a los productos
-- Ejecuta esto en el SQL Editor de Supabase
-- ============================================================

-- Añadir columna imagen_url (puede ser nula por defecto)
ALTER TABLE public.producto ADD COLUMN IF NOT EXISTS imagen_url TEXT;

-- Opcional: Actualizar los productos existentes con una imagen de relleno
UPDATE public.producto 
SET imagen_url = 'https://placehold.co/400x300/f8fafc/64748b?text=Sin+Foto'
WHERE imagen_url IS NULL;
