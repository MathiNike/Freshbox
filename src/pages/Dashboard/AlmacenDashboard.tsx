import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, CheckCircle, LogOut, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../services/supabase';
import type { Cliente} from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface PedidoProductoItem {
  cantidad: number;
  precio_unitario: number;
  producto: { nombre: string; imagen_url: string | null } | null;
}

interface PedidoAlmacen {
  id: string;
  fecha: string;
  fecha_preparacion?: string;
  monto_total: number;
  estado: string;
  cliente: Cliente;
  repartidor?: { nombre: string };
  pedido_producto: PedidoProductoItem[];
}

export default function AlmacenDashboard() {
  const [pedidos, setPedidos] = useState<PedidoAlmacen[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Historial States
  const [activeTab, setActiveTab] = useState<'pendientes' | 'historial'>('pendientes');
  const [historial, setHistorial] = useState<PedidoAlmacen[]>([]);
  const [isHistorialLoading, setIsHistorialLoading] = useState(false);

  const { profile, loading, signOut } = useAuth();
  const navigate = useNavigate();

  // Guardia de rol
  useEffect(() => {
    if (!loading && (!profile || profile.rol !== 'Almacen')) {
      navigate('/login');
    }
  }, [profile, loading, navigate]);

  // Fetch de pedidos con suscripción Realtime
  useEffect(() => {
    if (profile?.rol === 'Almacen') {
      fetchPedidosPendientes();
      fetchHistorialDespachos();

      const channel = supabase.channel('almacen-pedidos')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'pedido' },
          () => {
            fetchPedidosPendientes();
            fetchHistorialDespachos();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [profile]);

  const fetchPedidosPendientes = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('pedido')
        .select(`
          id,
          fecha,
          monto_total,
          estado,
          cliente ( id, nombre, direccion, telefono, referencia ),
          pedido_producto!relacion_almacen_oficial ( cantidad, precio_unitario, producto ( nombre, imagen_url ) )
        `)
        .eq('estado', 'pendiente')
        .order('fecha', { ascending: true });

      if (fetchError) {
        console.error('Error fetching pedidos:', fetchError.message);
        setError(fetchError.message);
        return;
      }

      if (data) {
        setPedidos(data as unknown as PedidoAlmacen[]);
      }
    } catch (err: any) {
      console.error('Error inesperado:', err.message || err);
      setError(err.message || 'Error al cargar pedidos');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHistorialDespachos = async () => {
    setIsHistorialLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('pedido')
        .select(`
          id,
          fecha,
          fecha_preparacion,
          monto_total,
          estado,
          cliente ( id, nombre, direccion, telefono, referencia ),
          repartidor:id_repartidor ( nombre ),
          pedido_producto!relacion_almacen_oficial ( cantidad, precio_unitario, producto ( nombre, imagen_url ) )
        `)
        .neq('estado', 'pendiente')
        .order('fecha', { ascending: false });

      if (fetchError) {
        console.error('Error fetching historial:', fetchError.message);
        return;
      }
      if (data) {
        setHistorial(data as unknown as PedidoAlmacen[]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsHistorialLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'historial') {
      fetchHistorialDespachos();
    } else {
      fetchPedidosPendientes();
    }
  }, [activeTab]);

  const handleMarcarListo = async (pedidoId: string) => {
    setUpdatingId(pedidoId);

    try {
      const { error: updateError } = await supabase
        .from('pedido')
        .update({ 
          estado: 'listo para despacho',
          fecha_preparacion: new Date().toISOString()
        })
        .eq('id', pedidoId);

      if (updateError) {
        console.error('Error al actualizar:', updateError.message);
        alert(`Error: ${updateError.message}`);
        return;
      }

      // Éxito: remover de la lista local
      setPedidos(prev => prev.filter(p => p.id !== pedidoId));
    } catch (err: any) {
      console.error('Error inesperado:', err.message || err);
      alert('Error inesperado al actualizar el pedido');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  // Estados de carga y guardia
  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-slate-500">Cargando panel...</p></div>;
  if (!profile || profile.rol !== 'Almacen') return null;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      {/* Header */}
      <header className="mb-6 md:mb-8 flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Panel de Almacén</h1>
          <p className="text-slate-500 text-sm md:text-base">Preparación de Pedidos para Despacho</p>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          <div className="text-right hidden md:block">
            <p className="font-semibold text-slate-700">{profile?.nombre || 'Cargando...'}</p>
            <p className="text-xs text-orange-600 font-medium bg-orange-50 inline-block px-2 py-0.5 rounded-full">{profile?.rol}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold">
            {profile?.nombre?.charAt(0).toUpperCase() || 'A'}
          </div>
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* KPI rápido */}
      <div className="mb-6 md:mb-8 flex flex-col md:flex-row gap-4 justify-between items-start md:items-end border-b border-slate-200 pb-4">
        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={() => setActiveTab('pendientes')}
            className={`flex-1 md:flex-none py-3 px-6 font-medium text-sm transition-colors rounded-xl ${activeTab === 'pendientes' ? 'bg-orange-500 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
          >
            Pendientes
          </button>
          <button
            onClick={() => setActiveTab('historial')}
            className={`flex-1 md:flex-none py-3 px-6 font-medium text-sm transition-colors rounded-xl ${activeTab === 'historial' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
          >
            Historial de Despachos
          </button>
        </div>

        {activeTab === 'pendientes' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center gap-4 min-w-[200px]">
            <div className="p-2.5 bg-amber-100 text-amber-600 rounded-xl">
              <Package size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Por preparar</p>
              <p className="text-xl font-bold text-slate-800">{pedidos.length}</p>
            </div>
          </div>
        )}
      </div>

      {activeTab === 'pendientes' ? (
        <>
          {/* Estado de carga */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Loader2 size={40} className="animate-spin mb-3" />
              <p>Cargando pedidos pendientes...</p>
            </div>
          )}

          {/* Estado de error */}
          {error && !isLoading && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-5 rounded-2xl flex items-start gap-3 mb-6">
              <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Error al cargar pedidos</p>
                <p className="text-sm mt-1">{error}</p>
                <button
                  onClick={fetchPedidosPendientes}
                  className="mt-3 text-sm font-medium text-red-800 bg-red-100 hover:bg-red-200 px-4 py-2 rounded-lg transition-colors"
                >
                  Reintentar
                </button>
              </div>
            </div>
          )}

          {/* Lista vacía */}
          {!isLoading && !error && pedidos.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
              <CheckCircle size={56} className="mb-4 opacity-30 text-emerald-500" />
              <p className="text-lg font-medium text-slate-600">¡Todo listo!</p>
              <p className="text-sm mt-1">No hay pedidos pendientes de preparación.</p>
            </div>
          )}

          {/* Grid de tarjetas */}
          {!isLoading && !error && pedidos.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
              {pedidos.map(pedido => (
                <div
                  key={pedido.id}
                  className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col transition-all hover:shadow-md"
                >
                  {/* Cabecera de la tarjeta */}
                  <div className="p-4 md:p-5 border-b border-slate-100 flex justify-between items-start">
                    <div>
                      <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">
                        Pendiente
                      </span>
                      <h3 className="font-bold text-slate-800 mt-2">Pedido #{pedido.id.substring(0, 8)}</h3>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {new Date(pedido.fecha).toLocaleDateString('es-PE', {
                          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <p className="font-bold text-lg text-emerald-600">S/ {pedido.monto_total.toFixed(2)}</p>
                  </div>

                  {/* Info del cliente */}
                  <div className="px-4 md:px-5 pt-4 pb-2">
                    <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Cliente</span>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <p className="font-medium text-slate-800">{pedido.cliente?.nombre || 'Cliente sin nombre'}</p>
                      {pedido.cliente?.direccion && (
                        <p className="text-sm text-slate-500 mt-0.5">{pedido.cliente.direccion}</p>
                      )}
                      {pedido.cliente?.telefono && (
                        <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1">📞 {pedido.cliente.telefono}</p>
                      )}
                    </div>
                  </div>

                  {/* Lista de productos a preparar */}
                  <div className="px-4 md:px-5 pt-2 pb-4 flex-1">
                    <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Artículos a preparar</span>
                    <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                      {pedido.pedido_producto && pedido.pedido_producto.length > 0 ? (
                        <ul className="divide-y divide-slate-100">
                          {pedido.pedido_producto.map((detalle, idx) => (
                            <li key={idx} className="px-3 py-2.5 flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                <img 
                                  src={detalle.producto?.imagen_url || 'https://placehold.co/50x50/f8fafc/64748b?text=Sin+Foto'}
                                  alt={detalle.producto?.nombre}
                                  className="w-10 h-10 rounded-md object-cover border border-slate-200"
                                />
                                <span className="text-sm text-slate-700 font-medium leading-tight">
                                  {detalle.producto?.nombre || 'Producto sin nombre'}
                                </span>
                              </div>
                              <span className="text-sm font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded-md">
                                x{detalle.cantidad}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="p-3 text-sm text-slate-400 text-center">Sin productos registrados</p>
                      )}
                    </div>
                  </div>

                  {/* Botón de acción */}
                  <div className="p-4 md:p-5 border-t border-slate-100 bg-slate-50/50">
                    <button
                      onClick={() => handleMarcarListo(pedido.id)}
                      disabled={updatingId === pedido.id}
                      className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm md:text-base"
                    >
                      {updatingId === pedido.id ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Actualizando...
                        </>
                      ) : (
                        <>
                          <CheckCircle size={18} />
                          Marcar Listo para Despacho
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {isHistorialLoading ? (
            <div className="p-16 text-center text-slate-400 flex flex-col items-center">
              <Loader2 size={32} className="animate-spin mb-2" />
              Cargando historial...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="p-4 font-medium">ID Pedido</th>
                    <th className="p-4 font-medium">Hora de Preparación</th>
                    <th className="p-4 font-medium">Contenido del Pedido</th>
                    <th className="p-4 font-medium">Repartidor Asignado</th>
                    <th className="p-4 font-medium">Estado Actual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historial.map(pedido => {
                    const totalBultos = pedido.pedido_producto?.reduce((sum, item) => sum + item.cantidad, 0) || 0;
                    return (
                      <tr key={pedido.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="p-4 font-medium text-slate-700">#{pedido.id.substring(0, 8)}</td>
                        <td className="p-4 text-slate-600">
                          {pedido.fecha_preparacion 
                            ? new Date(pedido.fecha_preparacion).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                            : new Date(pedido.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                          }
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="flex -space-x-2">
                              {pedido.pedido_producto?.slice(0, 3).map((item, i) => (
                                <img 
                                  key={i}
                                  src={item.producto?.imagen_url || 'https://placehold.co/50x50/f8fafc/64748b?text=Foto'} 
                                  className="w-8 h-8 rounded-full border-2 border-white object-cover bg-slate-100"
                                  title={`${item.cantidad}x ${item.producto?.nombre}`}
                                  alt=""
                                />
                              ))}
                              {(pedido.pedido_producto?.length || 0) > 3 && (
                                <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                  +{pedido.pedido_producto.length - 3}
                                </div>
                              )}
                            </div>
                            <span className="font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg text-xs ml-2">
                              {totalBultos} {totalBultos === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 font-medium text-slate-800">
                          {pedido.repartidor?.nombre || <span className="text-slate-400 italic">Sin asignar</span>}
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            pedido.estado?.toLowerCase() === 'listo para despacho' ? 'bg-orange-100 text-orange-700' :
                            pedido.estado?.toLowerCase() === 'asignado' ? 'bg-blue-100 text-blue-700' :
                            pedido.estado?.toLowerCase() === 'en ruta' ? 'bg-indigo-100 text-indigo-700' :
                            pedido.estado?.toLowerCase() === 'entregado' ? 'bg-emerald-100 text-emerald-700' :
                            pedido.estado?.toLowerCase() === 'incidencia' ? 'bg-red-100 text-red-700' :
                            pedido.estado?.toLowerCase() === 'cancelado' ? 'bg-slate-100 text-slate-500' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {pedido.estado}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {historial.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
                        Aún no hay despachos registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
