import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Leaf, Lock, Mail, Eye, EyeOff, Truck, Clock, MapPin, User as UserIcon } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<'Vendedor' | 'Supervisor' | 'Repartidor' | 'Almacen' | 'Administrador'>('Supervisor');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loadingMsg, setLoadingMsg] = useState('');
  
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (user && profile) {
      if (profile.rol === 'Supervisor') navigate('/dashboard');
      else if (profile.rol === 'Repartidor') navigate('/delivery');
      else if (profile.rol === 'Vendedor') navigate('/vendedor');
      else if (profile.rol === 'Almacen') navigate('/almacen');
      else if (profile.rol === 'Administrador') navigate('/admin');
      else navigate('/dashboard'); // Fallback
    }
  }, [user, profile, navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoadingMsg('Conectando...');

    try {
      if (isRegistering) {
        // 1. Register in Auth con metadata (el trigger SQL hará el insert en public.usuario)
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              nombre: nombre,
              rol: rol
            }
          }
        });

        if (authError) throw authError;

        // Mostrar alerta si requiere confirmación de email
        if (authData.user && authData.user.identities && authData.user.identities.length === 0) {
           alert('Registro exitoso. ¡Revisa tu correo para confirmar la cuenta antes de iniciar sesión!');
        } else {
           alert('Registro exitoso. ¡Revisa tu correo para confirmar si es necesario o intenta iniciar sesión!');
        }
        
      } else {
        // Login
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (loginError) throw loginError;
      }
    } catch (err: any) {
      setError(err.message || 'Error de autenticación');
    } finally {
      setLoadingMsg('');
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#4A7456] flex items-center justify-center text-white">Cargando sesión...</div>;
  }

  return (
    <div 
      className="min-h-screen w-full flex relative overflow-hidden font-sans bg-slate-900"
      style={{
        backgroundImage: `url('/amazon_river_sunset.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Overlay con degradado: Verde selva oscuro a la izquierda, transparente a la derecha */}
      <div 
        className="absolute inset-0 z-0" 
        style={{
          background: 'linear-gradient(to right, rgba(27, 67, 50, 0.95) 0%, rgba(27, 67, 50, 0.8) 35%, rgba(0,0,0,0) 100%)'
        }}
      ></div>

      {/* Lado Izquierdo (Oculto en móviles) */}
      <div className="hidden lg:flex w-1/2 flex-col justify-center p-12 xl:p-20 relative z-10">
        <h1 className="text-5xl xl:text-6xl font-bold text-white mb-2 tracking-tight">Frescura Amazónica</h1>
        <h2 className="text-4xl xl:text-5xl font-bold text-amber-400 mb-6">A Tu Puerta</h2>
        <p className="text-emerald-100 text-lg mb-10 max-w-md leading-relaxed">
          Delivery de productos frescos y naturales en Iquitos, directamente desde la selva a tu hogar.
        </p>

        {/* Tarjetas de características */}
        <div className="grid grid-cols-2 gap-4 max-w-lg mb-12">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-5 rounded-2xl hover:bg-white/20 transition-colors">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
              <Truck className="text-white" size={20} />
            </div>
            <h3 className="text-white font-bold mb-1">Entrega Rápida</h3>
            <p className="text-emerald-100 text-xs">Recibe tus pedidos en tiempo récord</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-5 rounded-2xl hover:bg-white/20 transition-colors">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
              <Leaf className="text-white" size={20} />
            </div>
            <h3 className="text-white font-bold mb-1">100% Fresco</h3>
            <p className="text-emerald-100 text-xs">Productos de la mejor calidad</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-5 rounded-2xl hover:bg-white/20 transition-colors">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
              <Clock className="text-white" size={20} />
            </div>
            <h3 className="text-white font-bold mb-1">Horario de Atención</h3>
            <p className="text-emerald-100 text-xs">8:00 AM - 6:00 PM</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-5 rounded-2xl hover:bg-white/20 transition-colors">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
              <MapPin className="text-white" size={20} />
            </div>
            <h3 className="text-white font-bold mb-1">Cobertura Local</h3>
            <p className="text-emerald-100 text-xs">Servicio en toda la ciudad</p>
          </div>
        </div>

        {/* Clientes satisfechos */}
        <div className="flex items-center gap-4 mt-auto">
          <div className="flex -space-x-3">
            <div className="w-10 h-10 rounded-full bg-amber-400 border-2 border-[#466d50]"></div>
            <div className="w-10 h-10 rounded-full bg-blue-400 border-2 border-[#466d50]"></div>
            <div className="w-10 h-10 rounded-full bg-emerald-600 border-2 border-[#466d50]"></div>
          </div>
          <div>
            <p className="text-white font-bold">+2,500 clientes satisfechos</p>
            <p className="text-emerald-200 text-xs">Confían en nosotros cada día</p>
          </div>
        </div>
      </div>

      {/* Lado Derecho (Tarjeta Blanca) */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 relative z-10">
        <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl p-8 sm:p-10 relative">
          {/* Logo y Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-12 h-12 bg-[#3A5D44] rounded-xl flex items-center justify-center text-white shadow-md">
                <Leaf size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800 leading-none tracking-tight">FreshBox</h1>
                <p className="text-[10px] font-bold text-blue-500 tracking-wider">Express S.A.C.</p>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-1">{isRegistering ? 'Crear Cuenta' : 'Bienvenido'}</h2>
            <p className="text-sm text-slate-500">{isRegistering ? 'Regístrate para continuar' : 'Inicia sesión para acceder a tu cuenta'}</p>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-600 rounded-xl text-sm text-center border border-red-100">
              {error}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-5">
            {isRegistering && (
              <>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Nombre Completo</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 rounded-xl border-none bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#3A5D44] transition-all pl-11 text-sm font-medium text-slate-800" 
                      placeholder="Juan Pérez"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      required
                    />
                    <UserIcon className="absolute left-4 top-3.5 text-slate-400" size={18} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Rol en el Sistema</label>
                  <select 
                    className="w-full px-4 py-3 rounded-xl border-none bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#3A5D44] transition-all text-sm font-medium text-slate-800"
                    value={rol}
                    onChange={(e) => setRol(e.target.value as any)}
                  >
                    <option value="Supervisor">Supervisor de Operaciones</option>
                    <option value="Repartidor">Repartidor</option>
                    <option value="Vendedor">Vendedor</option>
                    <option value="Almacen">Almacén</option>
                    <option value="Administrador">Administrador</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Correo Electrónico</label>
              <div className="relative">
                <input 
                  type="email" 
                  className="w-full px-4 py-3 rounded-xl border-none bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#3A5D44] transition-all pl-11 text-sm font-medium text-slate-800 placeholder:font-normal" 
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Mail className="absolute left-4 top-3.5 text-slate-400" size={18} />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Contraseña</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  className="w-full px-4 py-3 rounded-xl border-none bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#3A5D44] transition-all pl-11 pr-11 text-sm font-medium text-slate-800 placeholder:font-normal [&::-ms-reveal]:hidden [&::-ms-clear]:hidden" 
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Lock className="absolute left-4 top-3.5 text-slate-400" size={18} />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            
            <button 
              type="submit" 
              disabled={!!loadingMsg}
              className="bg-[#fbbd23] hover:bg-[#f5a50b] text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-amber-200 active:scale-95 w-full mt-6 text-sm transition-all disabled:opacity-50"
            >
              {loadingMsg ? loadingMsg : (isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión')}
            </button>
          </form>

          <div className="mt-8 text-center border-t border-slate-100 pt-6">
            <p className="text-sm text-slate-500 font-medium">
              {isRegistering ? '¿Ya tienes una cuenta?' : '¿No tienes una cuenta?'} {' '}
              <button 
                type="button" 
                onClick={() => setIsRegistering(!isRegistering)}
                className="text-[#3A5D44] font-bold hover:underline transition-all"
              >
                {isRegistering ? 'Inicia sesión aquí' : 'Regístrate aquí'}
              </button>
            </p>
          </div>

          <div className="mt-8 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Servicio de entregas en Iquitos, Perú</p>
          </div>
        </div>
      </div>
    </div>
  );
}
