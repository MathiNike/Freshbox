// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Manejar CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // @ts-ignore
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    // @ts-ignore
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 1. Validar Autorización (Solo Admins)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No se proporcionó token de autorización')

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: requester }, error: requesterError } = await supabaseClient.auth.getUser(token)
    
    if (requesterError || !requester) throw new Error('Token inválido o expirado')

    // Consultar el rol del solicitante en la tabla pública
    const { data: profile, error: profileError } = await supabaseClient
      .from('usuario')
      .select('rol')
      .eq('id', requester.id)
      .single()

    if (profileError || profile?.rol !== 'Administrador') {
      throw new Error('Acceso denegado: Se requieren permisos de Administrador.')
    }

    // 2. Extraer datos del body
    const { email, password, nombre_completo, rol } = await req.json()

    if (!email || !password || !nombre_completo || !rol) {
      throw new Error('Faltan campos obligatorios (email, password, nombre_completo, rol)')
    }

    // 3. Crear usuario en Auth
    const { data: userData, error: authError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre_completo, rol }
    })

    if (authError) throw authError

    const newUser = userData.user

    // 4. Insertar/Actualizar en la tabla pública (upsert para evitar conflictos con triggers)
    const { error: dbError } = await supabaseClient
      .from('usuario')
      .upsert({
        id: newUser.id,
        nombre: nombre_completo,
        email: email,
        rol: rol,
        activo: true
      })

    if (dbError) throw dbError

    return new Response(
      JSON.stringify({ message: 'Usuario creado exitosamente', user: newUser }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error('Error en Edge Function:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
