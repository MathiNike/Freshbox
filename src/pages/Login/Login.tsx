import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Leaf, Lock, Mail, Eye, EyeOff, Truck, Clock, MapPin } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      // Login
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) throw loginError;
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
            <h2 className="text-2xl font-bold text-slate-800 mb-1">Bienvenido</h2>
            <p className="text-sm text-slate-500">Inicia sesión para acceder a tu cuenta</p>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-600 rounded-xl text-sm text-center border border-red-100">
              {error}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-5">
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
              {loadingMsg ? loadingMsg : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Servicio de entregas en Iquitos, Perú</p>
          </div>
        </div>
      </div>
      {/* Botón Flotante de WhatsApp para Recuperar Contraseña */}
      <a
        href="https://wa.me/51960993396?text=Hola,%20olvidé%20mi%20contraseña%20del%20sistema%20Freshbox.%20¿Podrías%20ayudarme%20a%20restablecerla?"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 bg-[#25D366] hover:bg-[#20bd5a] text-white p-4 rounded-full shadow-2xl hover:shadow-green-500/50 hover:-translate-y-1 transition-all z-50 flex items-center justify-center group"
        title="¿Olvidaste tu contraseña?"
      >
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" className="w-8 h-8">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
        <span className="absolute right-16 bg-white text-slate-800 text-xs font-bold py-2 px-3 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          ¿Olvidaste tu contraseña?
        </span>
      </a>

    </div>
  );
}
