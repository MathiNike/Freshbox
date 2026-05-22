-- Tabla intermedia: Pedido <-> Producto
CREATE TABLE IF NOT EXISTS public.pedido_producto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_pedido UUID REFERENCES public.pedido(id) ON DELETE CASCADE,
  id_producto UUID, -- O cambiar a BIGINT si el ID de tu producto es un número
  cantidad INTEGER NOT NULL DEFAULT 1,
  precio_unitario DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.pedido_producto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo en pedido_producto" ON public.pedido_producto FOR ALL USING (true);
