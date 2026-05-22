-- Tabla de Usuarios (Perfiles extendidos vinculados a Auth)
CREATE TABLE IF NOT EXISTS public.usuario (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nombre TEXT NOT NULL,
  rol TEXT CHECK (rol IN ('Vendedor', 'Supervisor', 'Repartidor')) NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Habilitar Row Level Security (RLS) pero permitir todo temporalmente para desarrollo
ALTER TABLE public.usuario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo en usuario" ON public.usuario FOR ALL USING (true);

-- Tabla de Clientes
CREATE TABLE IF NOT EXISTS public.cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  direccion TEXT NOT NULL,
  telefono TEXT,
  coordenadas TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);
ALTER TABLE public.cliente ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo en cliente" ON public.cliente FOR ALL USING (true);

-- Tabla de Pedidos
CREATE TABLE IF NOT EXISTS public.pedido (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  id_cliente UUID REFERENCES public.cliente(id) ON DELETE CASCADE,
  id_repartidor UUID REFERENCES public.usuario(id) ON DELETE SET NULL,
  estado TEXT CHECK (estado IN ('Pendiente', 'Asignado', 'En ruta', 'Entregado', 'Incidencia')) DEFAULT 'Pendiente',
  monto_total DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);
ALTER TABLE public.pedido ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo en pedido" ON public.pedido FOR ALL USING (true);

-- Tabla de Incidencias
CREATE TABLE IF NOT EXISTS public.incidencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_pedido UUID REFERENCES public.pedido(id) ON DELETE CASCADE,
  motivo TEXT NOT NULL,
  ruta_foto TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);
ALTER TABLE public.incidencia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo en incidencia" ON public.incidencia FOR ALL USING (true);

-- -------------------------------------------------------------
-- TRIGGER PARA SINCRONIZAR AUTH.USERS CON PUBLIC.USUARIO
-- (Esta es la versión correcta que no fallará)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.usuario (id, email, nombre, rol)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'nombre', 'Usuario Nuevo'),
    COALESCE(new.raw_user_meta_data->>'rol', 'Repartidor')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recrear el trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
