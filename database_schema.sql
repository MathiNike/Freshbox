-- Sistema Logístico de Reparto (SLR-FBE) - Freshbox Express
-- Esquema de Base de Datos para Supabase

-- 1. Enums
CREATE TYPE public.user_role AS ENUM ('Vendedor', 'Supervisor', 'Repartidor', 'Almacen', 'Administrador');
CREATE TYPE public.order_status AS ENUM ('Pendiente', 'Listo para Despacho', 'Asignado', 'En ruta', 'Entregado', 'Incidencia', 'Cancelado');

-- 2. Tablas
CREATE TABLE public.usuario (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    rol public.user_role NOT NULL,
    email TEXT UNIQUE NOT NULL,
    activo BOOLEAN DEFAULT true
);

CREATE TABLE public.cliente (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    telefono TEXT,
    direccion TEXT NOT NULL,
    referencia TEXT
);

CREATE TABLE public.producto (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    precio_unitario DECIMAL(10, 2) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    estado BOOLEAN DEFAULT true
);

CREATE TABLE public.pedido (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    id_cliente UUID REFERENCES public.cliente(id) NOT NULL,
    id_vendedor UUID REFERENCES public.usuario(id),
    id_repartidor UUID REFERENCES public.usuario(id),
    estado public.order_status DEFAULT 'Pendiente',
    monto_total DECIMAL(10, 2) NOT NULL DEFAULT 0,
    fecha_preparacion TIMESTAMP WITH TIME ZONE
);

CREATE TABLE public.detalle_pedido (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_pedido UUID REFERENCES public.pedido(id) ON DELETE CASCADE,
    id_producto UUID REFERENCES public.producto(id),
    cantidad INTEGER NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL
);

CREATE TABLE public.incidencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_pedido UUID REFERENCES public.pedido(id) ON DELETE CASCADE,
    motivo TEXT NOT NULL,
    ruta_foto TEXT NOT NULL,
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Row Level Security (RLS)
ALTER TABLE public.usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidencia ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad (Ejemplos permisivos para iniciar, ajustar en producción)
CREATE POLICY "Lectura general para autenticados" ON public.usuario FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lectura general para autenticados" ON public.cliente FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lectura general para autenticados" ON public.producto FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lectura general para autenticados" ON public.pedido FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lectura general para autenticados" ON public.detalle_pedido FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lectura general para autenticados" ON public.incidencia FOR SELECT TO authenticated USING (true);

CREATE POLICY "Modificación pedidos supervisor" ON public.pedido FOR ALL TO authenticated USING (
    (SELECT rol FROM public.usuario WHERE id = auth.uid()) = 'Supervisor'
);
CREATE POLICY "Modificación pedidos vendedor" ON public.pedido FOR INSERT TO authenticated WITH CHECK (
    (SELECT rol FROM public.usuario WHERE id = auth.uid()) IN ('Vendedor', 'Supervisor')
);
CREATE POLICY "Actualización de pedidos repartidor" ON public.pedido FOR UPDATE TO authenticated USING (
    auth.uid() = id_repartidor OR (SELECT rol FROM public.usuario WHERE id = auth.uid()) = 'Supervisor'
);

-- Habilitar Realtime para pedidos e incidencias
ALTER PUBLICATION supabase_realtime ADD TABLE public.pedido;
ALTER PUBLICATION supabase_realtime ADD TABLE public.incidencia;
