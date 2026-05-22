import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Navigation, CheckCircle, AlertTriangle, LogOut, X, Map, Package } from 'lucide-react';
import { supabase } from '../../services/supabase';
import type { Pedido, Cliente } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface PedidoConCliente extends Pedido {
  cliente: Cliente;
  pedido_producto?: {
    cantidad: number;
    producto: { nombre: string; imagen_url: string | null };
  }[];
}

export default function MobileDelivery() {
  const [pedidosAsignados, setPedidosAsignados] = useState<PedidoConCliente[]>([]);
  const [pedidoActivo, setPedidoActivo] = useState<PedidoConCliente | null>(null);
  
  // Incidencia Modal States
  const [isIncidenciaModalOpen, setIsIncidenciaModalOpen] = useState(false);
  const [incidenciaMotivo, setIncidenciaMotivo] = useState('');
  const [incidenciaFoto, setIncidenciaFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [isSubmittingIncidencia, setIsSubmittingIncidencia] = useState(false);

  const { profile, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!profile || profile.rol !== 'Repartidor')) {
      navigate('/login');
    }
  }, [profile, loading, navigate]);

  useEffect(() => {
    if (profile?.rol === 'Repartidor') {
      fetchPedidosAsignados();
    }
  }, [profile]);

  const fetchPedidosAsignados = async () => {
    // Usamos profile?.id como el usuarioActualId (Repartidor logueado)
    const usuarioActualId = profile?.id;
    if (!usuarioActualId) return;

    const { data, error } = await supabase
      .from('pedido')
      .select(`*, cliente(*), pedido_producto(cantidad, producto(nombre, imagen_url))`)
      .eq('id_repartidor', usuarioActualId)
      .in('estado', ['asignado', 'en ruta']);
      
    if (error) {
      console.error("Error fetching pedidos:", error.message || error);
    }
      
    if (data) {
      const pedidos = data as unknown as PedidoConCliente[];
      setPedidosAsignados(pedidos.filter(p => p.estado === 'asignado'));
      const enRuta = pedidos.find(p => p.estado === 'en ruta');
      if (enRuta) setPedidoActivo(enRuta);
    }
  };

  const iniciarRuta = async (pedido: PedidoConCliente) => {
    const { error } = await supabase
      .from('pedido')
      .update({ estado: 'en ruta' })
      .eq('id', pedido.id);
      
    if (!error) {
      setPedidoActivo({ ...pedido, estado: 'en ruta' });
      setPedidosAsignados(prev => prev.filter(p => p.id !== pedido.id));
    } else {
      alert('Error al iniciar ruta');
    }
  };

  const finalizarEntrega = async () => {
    if (!pedidoActivo) return;
    
    const { error } = await supabase
      .from('pedido')
      .update({ estado: 'entregado' })
      .eq('id', pedidoActivo.id);
      
    if (!error) {
      alert('Entrega finalizada con éxito.');
      setPedidoActivo(null);
    } else {
      alert('Error al finalizar la entrega');
    }
  };

  const reportarIncidencia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pedidoActivo || !incidenciaMotivo) return;
    
    setIsSubmittingIncidencia(true);

    try {
      let fotoUrl = 'https://placehold.co/400x300/e2e8f0/475569?text=Sin+Foto+Adjunta';

      // 1. Si hay foto, subirla al bucket 'evidencias'
      if (incidenciaFoto) {
        const fileExt = incidenciaFoto.name.split('.').pop() || 'jpg';
        const fileName = `${Date.now()}_${pedidoActivo.id}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('evidencias')
          .upload(filePath, incidenciaFoto);

        if (uploadError) {
          console.error("Error subiendo foto:", uploadError);
          alert('Hubo un problema al subir la foto, pero intentaremos guardar la incidencia de todas formas.');
        } else {
          const { data: publicUrlData } = supabase.storage
            .from('evidencias')
            .getPublicUrl(filePath);
          fotoUrl = publicUrlData.publicUrl;
        }
      }

      // 2. Crear incidencia
      const { error: errorIncidencia } = await supabase.from('incidencia').insert([{
        id_pedido: pedidoActivo.id,
        motivo: incidenciaMotivo,
        ruta_foto: fotoUrl
      }]);

      if (errorIncidencia) throw errorIncidencia;

      // 2. Actualizar estado
      const { error: errorPedido } = await supabase
        .from('pedido')
        .update({ estado: 'incidencia' })
        .eq('id', pedidoActivo.id);
        
      if (errorPedido) throw errorPedido;

      alert('Incidencia reportada correctamente.');
      setIsIncidenciaModalOpen(false);
      setIncidenciaMotivo('');
      setIncidenciaFoto(null);
      setFotoPreview(null);
      setPedidoActivo(null);
    } catch (error) {
      console.error(error);
      alert('Error al reportar incidencia');
    } finally {
      setIsSubmittingIncidencia(false);
    }
  };

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIncidenciaFoto(file);
      setFotoPreview(URL.createObjectURL(file));
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const abrirGoogleMaps = (direccion: string, referencia: string | null) => {
    // Añadimos 'Iquitos, Peru' para que Google ubique rápido la ciudad (ajustar si es otra).
    // También adjuntamos la referencia para mayor exactitud.
    const ubicacionCompleta = `${direccion} ${referencia ? '(' + referencia + ')' : ''}, Iquitos, Perú`;
    const query = encodeURIComponent(ubicacionCompleta);
    // Este enlace universal abrirá la app nativa de Maps/Waze en Android/iOS o una nueva pestaña en PC
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${query}`, '_blank');
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-slate-500">Cargando aplicación móvil...</p></div>;
  if (!profile || profile.rol !== 'Repartidor') return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto relative shadow-2xl overflow-hidden border-x border-slate-200">
      {/* Header App Móvil */}
      <div className="bg-[var(--color-primary)] text-white p-5 rounded-b-3xl shadow-md z-10 relative">
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-emerald-100 text-sm">Hola, {profile?.nombre?.split(' ')[0] || 'Repartidor'}</p>
            <h1 className="text-xl font-bold">Rutas de Hoy</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold">
              {profile?.nombre?.charAt(0).toUpperCase() || 'R'}
            </div>
            <button onClick={handleLogout} className="text-emerald-100 hover:text-white transition-colors">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        
        {pedidoActivo ? (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden p-5 border-l-4 border-l-blue-500">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider mb-2 inline-block">En Ruta Actual</span>
                <h2 className="font-bold text-lg text-slate-800">Pedido #{pedidoActivo.id.substring(0,8)}</h2>
              </div>
              <p className="font-bold text-emerald-600 text-lg">S/ {pedidoActivo.monto_total.toFixed(2)}</p>
            </div>
            
            <div className="mb-6 space-y-3">
              <div className="flex gap-3 text-slate-700 items-start">
                <MapPin className="text-[var(--color-primary)] mt-1 flex-shrink-0" size={20} />
                <div className="flex-1">
                  <p className="font-bold leading-tight">{pedidoActivo.cliente.direccion}</p>
                  <p className="text-sm text-slate-500 mt-0.5">Ref: {pedidoActivo.cliente.referencia || 'Sin referencia'}</p>
                  <button 
                    onClick={() => abrirGoogleMaps(pedidoActivo.cliente.direccion, pedidoActivo.cliente.referencia)}
                    className="mt-3 w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors border border-blue-200"
                  >
                    <Map size={18} />
                    🗺️ Iniciar Navegación
                  </button>
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="font-medium text-slate-800">{pedidoActivo.cliente.nombre}</p>
                {pedidoActivo.cliente.telefono && <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">📞 {pedidoActivo.cliente.telefono}</p>}
              </div>

              {/* Lista de productos a entregar */}
              {pedidoActivo.pedido_producto && pedidoActivo.pedido_producto.length > 0 && (
                <div className="bg-white p-3 rounded-xl border border-slate-200 mt-4 shadow-sm">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Detalle del paquete:</p>
                  <div className="space-y-3">
                    {pedidoActivo.pedido_producto.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <img 
                          src={item.producto.imagen_url || 'https://placehold.co/100x100/f8fafc/64748b?text=Sin+Foto'} 
                          alt={item.producto.nombre} 
                          className="w-12 h-12 rounded-lg object-cover border border-slate-200 shadow-sm"
                        />
                        <div className="flex-1">
                          <p className="font-bold text-slate-800 text-sm leading-tight">{item.producto.nombre}</p>
                          <p className="text-xs font-medium text-[var(--color-primary)] mt-0.5">Cant: {item.cantidad}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <button 
                onClick={finalizarEntrega}
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-medium py-3 px-4 rounded-xl transition-colors shadow-sm active:scale-95 flex flex-col items-center justify-center gap-1 transition-transform"
              >
                <CheckCircle size={24} />
                <span className="text-xs font-bold">Entregado</span>
              </button>
              <button 
                onClick={() => setIsIncidenciaModalOpen(true)}
                className="py-3 flex flex-col items-center justify-center gap-1 bg-red-50 text-red-600 rounded-xl border border-red-200 active:scale-95 transition-transform"
              >
                <AlertTriangle size={24} />
                <span className="text-xs font-bold">Incidencia</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-slate-500 font-medium mb-3 text-sm uppercase tracking-wider">Pendientes de Iniciar ({pedidosAsignados.length})</h2>
            <div className="space-y-4">
              {pedidosAsignados.map(pedido => (
                <div key={pedido.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-slate-800">Pedido #{pedido.id.substring(0,8)}</h3>
                      <p className="text-sm text-slate-500 font-medium">{pedido.cliente.nombre}</p>
                    </div>
                    <p className="font-bold text-emerald-600">S/ {pedido.monto_total.toFixed(2)}</p>
                  </div>
                  <div className="mb-4 flex flex-col gap-2 text-slate-600 text-sm">
                    <div className="flex items-start gap-2">
                      <MapPin className="text-[var(--color-primary)] mt-0.5 flex-shrink-0" size={16} />
                      <p className="line-clamp-2">{pedido.cliente.direccion}</p>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 font-medium">
                      <Package size={16} className="text-slate-400" />
                      <p>{pedido.pedido_producto?.reduce((sum, item) => sum + item.cantidad, 0) || 0} artículos a entregar</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => iniciarRuta(pedido)}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-[var(--color-primary)] rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <Navigation size={18} />
                    Iniciar Ruta
                  </button>
                </div>
              ))}
              {pedidosAsignados.length === 0 && (
                <div className="text-center py-10 text-slate-400">
                  <CheckCircle size={48} className="mx-auto mb-3 opacity-20" />
                  <p>No tienes más pedidos asignados</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modal: Reportar Incidencia */}
      {isIncidenciaModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-10 sm:fade-in duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-red-50">
              <h3 className="font-bold text-lg text-red-800 flex items-center gap-2">
                <AlertTriangle size={20} /> Reportar Problema
              </h3>
              <button onClick={() => setIsIncidenciaModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={reportarIncidencia} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Motivo / Descripción *</label>
                <textarea 
                  required
                  rows={3}
                  placeholder="Describe brevemente lo ocurrido (ej. Cliente no se encuentra, dirección incorrecta)"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                  value={incidenciaMotivo}
                  onChange={e => setIncidenciaMotivo(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Evidencia (Tomar Foto)</label>
                <div className="relative">
                  <input 
                    type="file" 
                    accept="image/*"
                    capture="environment"
                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
                    onChange={handleFotoChange}
                  />
                </div>
                {fotoPreview && (
                  <div className="mt-3 relative rounded-xl overflow-hidden border border-slate-200">
                    <img src={fotoPreview} alt="Vista previa de evidencia" className="w-full h-40 object-cover" />
                    <button 
                      type="button"
                      onClick={() => { setIncidenciaFoto(null); setFotoPreview(null); }}
                      className="absolute top-2 right-2 bg-slate-900/50 text-white p-1.5 rounded-full hover:bg-slate-900/70 backdrop-blur-sm transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={isSubmittingIncidencia || !incidenciaMotivo}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {isSubmittingIncidencia ? 'Enviando...' : 'Confirmar Incidencia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
