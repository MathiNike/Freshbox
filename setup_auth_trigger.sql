-- Ejecuta esto en el SQL Editor de Supabase

-- Función que se ejecuta automáticamente cuando se crea un usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.usuario (id, email, nombre, rol)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'nombre',
    CAST(new.raw_user_meta_data->>'rol' AS public.user_role)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger que escucha a Supabase Auth (cuando alguien se registra)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
