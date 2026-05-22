import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, CheckCircle, AlertTriangle, Clock, LogOut, X, Package, User, Eye, ChevronRight, Search } from 'lucide-react';
import { supabase } from '../../services/supabase';
import type { Usuario } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface PedidoProductoItem {
  cantidad: number;
  precio_unitario: number;
  producto: { nombre: string; imagen_url: string | null } | null;
}

interface IncidenciaItem {
  id: string;
  motivo: string;
  ruta_foto: string | null;
  fecha_registro: string;
}



interface PedidoMaestro {
  id: string;
  fecha: string;
  estado: string;
  monto_total: number;
  id_vendedor?: string;
  id_repartidor?: string;
  fecha_preparacion?: string;
  cliente: { nombre: string; telefono: string | null } | null;
  vendedor: { nombre: string } | null;
  repartidor: { nombre: string } | null;
  incidencia: IncidenciaItem[];
  pedido_producto: PedidoProductoItem[];
}

type FiltroEstado = 'todos' | 'pendiente' | 'listo para despacho' | 'asignado' | 'en ruta' | 'entregado' | 'incidencia' | 'cancelado';

export default function SupervisorDashboard() {
  const [pedidos, setPedidos] = useState<PedidoMaestro[]>([]);
  const [repartidores, setRepartidores] = useState<Usuario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filtro, setFiltro] = useState<FiltroEstado>('todos');

  // Panel lateral de detalle
  const [selectedPedido, setSelectedPedido] = useState<PedidoMaestro | null>(null);

  // Modal asignar
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedPedidoId, setSelectedPedidoId] = useState<string | null>(null);
  const [selectedRepartidorId, setSelectedRepartidorId] = useState<string>('');

  // Búsqueda global
  const [busqueda, setBusqueda] = useState('');



  const { profile, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!profile || profile.rol !== 'Supervisor')) {
      navigate('/login');
    }
  }, [profile, loading, navigate]);

  useEffect(() => {
    if (profile?.rol !== 'Supervisor') return;
    fetchPedidos();
    fetchRepartidores();

    const channel = supabase.channel('supervisor-pedidos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedido' }, () => {
        fetchPedidos();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  const fetchPedidos = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('pedido')
      .select(`
        *,
        cliente ( nombre, telefono ),
        vendedor:id_vendedor ( nombre ),
        repartidor:id_repartidor ( nombre ),
        incidencia ( * ),
        pedido_producto!relacion_almacen_oficial (
          cantidad,
          precio_unitario,
          producto ( nombre, imagen_url )
        )
      `)
      .order('fecha', { ascending: false });

    if (!error && data) setPedidos(data as unknown as PedidoMaestro[]);
    setIsLoading(false);
  };

  const fetchRepartidores = async () => {
    const { data, error } = await supabase.from('usuario').select('*').eq('rol', 'Repartidor');
    if (!error && data) setRepartidores(data);
  };

  const handleAssignRepartidor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPedidoId || !selectedRepartidorId) return;

    const { error } = await supabase
      .from('pedido')
      .update({ id_repartidor: selectedRepartidorId, estado: 'asignado' })
      .eq('id', selectedPedidoId);

    if (error) {
      alert('Error al asignar repartidor: ' + error.message);
      return;
    }

    // Paso 3: Cerrar modal y refrescar datos
    setIsAssignModalOpen(false);
    setSelectedPedidoId(null);
    setSelectedRepartidorId('');
    await fetchPedidos();
  };




  const handleResolverIncidencia = async (nuevoEstado: 'cancelado') => {
    if (!selectedPedido) return;
    const { error } = await supabase
      .from('pedido')
      .update({ estado: nuevoEstado })
      .eq('id', selectedPedido.id);
    if (!error) {
      setSelectedPedido(null);
      fetchPedidos();
    } else {
      alert('Error al resolver incidencia');
    }
  };

  const handleLogout = async () => { await signOut(); navigate('/login'); };



  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-slate-500">Cargando panel...</p></div>;
  if (!profile || profile.rol !== 'Supervisor') return null;

  const busquedaLower = busqueda.toLowerCase().trim();

  const pedidosFiltrados = pedidos.filter(p => {
    const estadoOk = filtro === 'todos' || p.estado?.toLowerCase() === filtro;
    if (!busquedaLower) return estadoOk;
    const matchId = p.id.toLowerCase().includes(busquedaLower);
    const matchCliente = p.cliente?.nombre?.toLowerCase().includes(busquedaLower) ?? false;
    const matchVendedor = p.vendedor?.nombre?.toLowerCase().includes(busquedaLower) ?? false;
    const matchRepartidor = p.repartidor?.nombre?.toLowerCase().includes(busquedaLower) ?? false;
    return estadoOk && (matchId || matchCliente || matchVendedor || matchRepartidor);
  });

  const byEstado = (e: string) => pedidos.filter(p => p.estado?.toLowerCase() === e).length;
  const stats = {
    total: pedidos.length,
    porPreparar: byEstado('pendiente'),
    listoDespacho: byEstado('listo para despacho'),
    asignado: byEstado('asignado'),
    enRuta: byEstado('en ruta'),
    entregado: byEstado('entregado'),
    incidencia: byEstado('incidencia'),
    cancelado: byEstado('cancelado'),
    finalizados: byEstado('entregado') + byEstado('cancelado'),
    enOperacion: byEstado('asignado') + byEstado('en ruta'),
    incidencias: byEstado('incidencia'),
  };

  const getBadgeClass = (estado: string) => {
    switch (estado?.toLowerCase()) {
      case 'pendiente': return 'bg-amber-100 text-amber-700';
      case 'listo para despacho': return 'bg-orange-100 text-orange-700';
      case 'asignado': return 'bg-blue-100 text-blue-700';
      case 'en ruta': return 'bg-indigo-100 text-indigo-700';
      case 'entregado': return 'bg-emerald-100 text-emerald-700';
      case 'incidencia': return 'bg-red-100 text-red-700';
      case 'cancelado': return 'bg-slate-100 text-slate-500';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const filtros: { label: string; value: FiltroEstado; color: string; count: number; emptyMsg: string }[] = [
    { label: 'Todos',                value: 'todos',              color: 'bg-slate-700 text-white',   count: stats.total,        emptyMsg: 'No hay pedidos registrados aún.' },
    { label: 'Pendientes',           value: 'pendiente',          color: 'bg-amber-500 text-white',   count: stats.porPreparar,  emptyMsg: 'No hay pedidos pendientes.' },
    { label: 'Listos para Despacho', value: 'listo para despacho',color: 'bg-orange-500 text-white',  count: stats.listoDespacho,emptyMsg: 'No hay pedidos listos para despacho.' },
    { label: 'Asignados',            value: 'asignado',           color: 'bg-blue-500 text-white',    count: stats.asignado,     emptyMsg: 'No hay pedidos asignados.' },
    { label: 'En Ruta',              value: 'en ruta',            color: 'bg-indigo-500 text-white',  count: stats.enRuta,       emptyMsg: 'No hay pedidos en ruta.' },
    { label: 'Entregados',           value: 'entregado',          color: 'bg-emerald-600 text-white', count: stats.entregado,    emptyMsg: 'No hay pedidos entregados aún.' },
    { label: 'Incidencias',          value: 'incidencia',         color: 'bg-red-600 text-white',     count: stats.incidencia,   emptyMsg: 'Sin incidencias activas. Todo marcha bien.' },
    { label: 'Cancelados',           value: 'cancelado',          color: 'bg-slate-500 text-white',   count: stats.cancelado,    emptyMsg: 'No hay pedidos cancelados.' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Monitor Global de Pedidos</h1>
          <p className="text-slate-500 text-sm">Trazabilidad completa · {pedidos.length} pedidos totales</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="font-semibold text-slate-700">{profile?.nombre}</p>
            <p className="text-xs text-emerald-600 font-medium bg-emerald-50 inline-block px-2 py-0.5 rounded-full">{profile?.rol}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-sm">
            {profile?.nombre?.charAt(0).toUpperCase() || 'S'}
          </div>
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="p-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3 shadow-sm">
            <div className="p-2.5 bg-amber-100 text-amber-600 rounded-xl"><Clock size={20} /></div>
            <div><p className="text-xs text-slate-500">Por Preparar</p><p className="text-xl font-bold text-slate-800">{stats.porPreparar}</p></div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3 shadow-sm">
            <div className="p-2.5 bg-blue-100 text-blue-600 rounded-xl"><Truck size={20} /></div>
            <div><p className="text-xs text-slate-500">En Operación</p><p className="text-xl font-bold text-slate-800">{stats.enOperacion}</p></div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3 shadow-sm">
            <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-xl"><CheckCircle size={20} /></div>
            <div><p className="text-xs text-slate-500">Finalizados</p><p className="text-xl font-bold text-slate-800">{stats.finalizados}</p></div>          </div>
          <div className={`bg-white rounded-2xl border p-4 flex items-center gap-3 shadow-sm ${stats.incidencias > 0 ? 'border-l-4 border-l-red-500 border-slate-100' : 'border-slate-100'}`}>
            <div className="p-2.5 bg-red-100 text-red-600 rounded-xl"><AlertTriangle size={20} /></div>
            <div><p className="text-xs text-slate-500">Incidencias</p><p className={`text-xl font-bold ${stats.incidencias > 0 ? 'text-red-600' : 'text-slate-800'}`}>{stats.incidencias}</p></div>
          </div>
        </div>

        {/* Buscador + Filtros */}
        <div className="flex flex-col gap-3 mb-5">
          {/* Buscador */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por cliente, vendedor, repartidor o ID..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
            {busqueda && (
              <button onClick={() => setBusqueda('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            )}
          </div>

          {/* Tabs de filtro */}
          <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-3">
            {filtros.map(f => (
              <button
                key={f.value}
                onClick={() => setFiltro(f.value)}
                className={`px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${
                  filtro === f.value
                    ? f.color + ' shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {f.label}
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                  filtro === f.value ? 'bg-white/25' : 'bg-slate-100 text-slate-500'
                }`}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-16 text-center text-slate-400">Cargando pedidos...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="p-4 font-medium">Pedido</th>
                    <th className="p-4 font-medium">Cliente</th>
                    <th className="p-4 font-medium">Vendedor</th>
                    <th className="p-4 font-medium">Repartidor</th>
                    <th className="p-4 font-medium">Total</th>
                    <th className="p-4 font-medium">Estado</th>
                    <th className="p-4 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pedidosFiltrados.length === 0 ? (
                    <tr><td colSpan={7} className="p-10 text-center text-slate-400">
                      {filtros.find(f => f.value === filtro)?.emptyMsg || 'No hay pedidos con este filtro.'}
                    </td></tr>
                  ) : pedidosFiltrados.map(pedido => (
                    <tr
                      key={pedido.id}
                      className={`hover:bg-slate-50/60 transition-colors cursor-pointer ${pedido.estado === 'Incidencia' ? 'bg-red-50/30' : ''}`}
                      onClick={() => setSelectedPedido(pedido)}
                    >
                      <td className="p-4 font-mono text-slate-600 font-medium">#{pedido.id.substring(0, 8)}</td>
                      <td className="p-4">
                        <p className="font-medium text-slate-800">{pedido.cliente?.nombre || <span className="text-slate-400 italic">Sin cliente</span>}</p>
                        {pedido.cliente?.telefono && <p className="text-xs text-slate-400">{pedido.cliente.telefono}</p>}
                      </td>
                      <td className="p-4 text-slate-600 text-sm">{pedido.vendedor?.nombre || <span className="italic text-slate-300">—</span>}</td>
                      <td className="p-4 text-slate-600">
                        {pedido.repartidor?.nombre || <span className="text-slate-400 italic">Sin asignar</span>}
                      </td>
                      <td className="p-4 font-bold text-emerald-600">S/ {pedido.monto_total.toFixed(2)}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${getBadgeClass(pedido.estado)}`}>
                          {pedido.estado === 'Incidencia' && <AlertTriangle size={11} />}
                          {pedido.estado}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          {/* Botón Asignar: SOLO si estado es exactamente 'listo para despacho' */}
                          {pedido.estado?.toLowerCase() === 'listo para despacho' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedPedidoId(pedido.id); setIsAssignModalOpen(true); }}
                              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                            >
                              Asignar
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedPedido(pedido); }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Eye size={16} />
                          </button>
                          <ChevronRight size={16} className="text-slate-300 self-center" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Panel Lateral: Detalle de Pedido */}
      {selectedPedido && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-slate-900/40" onClick={() => { setSelectedPedido(null); }} />
          <div className="w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Header del panel */}
            <div className={`p-5 border-b flex justify-between items-start ${selectedPedido.estado === 'Incidencia' ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
              <div>
                <p className="text-xs text-slate-500 font-mono mb-1">#{selectedPedido.id.substring(0, 8)}</p>
                <h3 className="font-bold text-lg text-slate-800">Detalle del Pedido</h3>
                <span className={`mt-1 px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${getBadgeClass(selectedPedido.estado)}`}>
                  {selectedPedido.estado === 'Incidencia' && <AlertTriangle size={11} />}
                  {selectedPedido.estado}
                </span>
              </div>
              <button onClick={() => { setSelectedPedido(null); }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Trazabilidad */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1"><User size={11} /> Cliente</p>
                  <p className="font-semibold text-slate-800 text-sm">{selectedPedido.cliente?.nombre || '—'}</p>
                  {selectedPedido.cliente?.telefono && <p className="text-xs text-slate-500 mt-0.5">{selectedPedido.cliente.telefono}</p>}
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1"><Truck size={11} /> Repartidor</p>
                  <p className="font-semibold text-slate-800 text-sm">{selectedPedido.repartidor?.nombre || <span className="text-slate-400 italic font-normal">Sin asignar</span>}</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Fecha del Pedido</p>
                <p className="text-sm text-slate-700">{new Date(selectedPedido.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                {selectedPedido.fecha_preparacion && (
                  <p className="text-xs text-slate-500 mt-1">Preparado: {new Date(selectedPedido.fecha_preparacion).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                )}
              </div>

              {/* Productos */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Package size={13} /> Productos del Pedido
                </h4>
                <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
                  {selectedPedido.pedido_producto?.length > 0 ? (
                    <ul className="divide-y divide-slate-50">
                      {selectedPedido.pedido_producto.map((item, i) => (
                        <li key={i} className="flex justify-between items-center px-4 py-3 gap-3">
                          <div className="flex items-center gap-3">
                            <img 
                              src={item.producto?.imagen_url || 'https://placehold.co/100x100/f8fafc/64748b?text=Sin+Foto'} 
                              alt={item.producto?.nombre}
                              className="w-10 h-10 rounded-lg object-cover border border-slate-200"
                            />
                            <div>
                              <p className="text-sm font-medium text-slate-800 leading-tight">{item.producto?.nombre || 'Producto'}</p>
                              <p className="text-xs text-slate-400 mt-0.5">x{item.cantidad} · S/ {item.precio_unitario.toFixed(2)} c/u</p>
                            </div>
                          </div>
                          <p className="text-sm font-bold text-slate-700 whitespace-nowrap">S/ {(item.cantidad * item.precio_unitario).toFixed(2)}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="p-4 text-sm text-slate-400 text-center">Sin detalle de productos.</p>
                  )}
                  <div className="flex justify-between items-center px-4 py-3 bg-slate-50 border-t border-slate-100">
                    <p className="font-bold text-slate-700">TOTAL</p>
                    <p className="font-bold text-emerald-600 text-base">S/ {selectedPedido.monto_total.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Incidencia */}
                {selectedPedido.incidencia?.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1"><AlertTriangle size={12} /> Incidencia Reportada</h4>
                  <p className="text-sm text-red-800">{selectedPedido.incidencia[selectedPedido.incidencia.length - 1].motivo}</p>
                  {selectedPedido.incidencia[selectedPedido.incidencia.length - 1].ruta_foto && (
                    <img
                      src={selectedPedido.incidencia[selectedPedido.incidencia.length - 1].ruta_foto || undefined}
                      alt="Evidencia"
                      className="mt-3 w-full rounded-lg object-cover max-h-40"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  )}
                  {selectedPedido.estado?.toLowerCase() === 'incidencia' ? (
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => { setSelectedPedidoId(selectedPedido.id); setIsAssignModalOpen(true); }} className="flex-1 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-xs font-semibold transition-colors">
                        Reasignar Pedido
                      </button>
                      <button onClick={() => handleResolverIncidencia('cancelado')} className="flex-1 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-xs font-semibold transition-colors">
                        Cancelar Pedido
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center gap-2 bg-slate-100 text-slate-500 rounded-lg px-3 py-2 text-xs font-medium">
                      <CheckCircle size={13} />
                      Gestión finalizada · Pedido {selectedPedido.estado}
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Footer: Asignar — solo si estado es exactamente 'listo para despacho' */}
            {selectedPedido.estado?.toLowerCase() === 'listo para despacho' && (
              <div className="p-4 border-t border-slate-100 bg-slate-50">
                <button
                  onClick={() => { setSelectedPedidoId(selectedPedido.id); setIsAssignModalOpen(true); }}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Truck size={18} /> Asignar Repartidor
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Asignar Repartidor */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-800">Asignar Repartidor</h3>
              <button onClick={() => setIsAssignModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleAssignRepartidor} className="p-5">
              <label className="block text-sm font-medium text-slate-700 mb-2">Selecciona un repartidor:</label>
              <select
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                value={selectedRepartidorId}
                onChange={(e) => setSelectedRepartidorId(e.target.value)}
                required
              >
                <option value="" disabled>-- Elige uno --</option>
                {repartidores.map(rep => (
                  <option key={rep.id} value={rep.id}>{rep.nombre}</option>
                ))}
              </select>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setIsAssignModalOpen(false)} className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-medium">Cancelar</button>
                <button type="submit" disabled={!selectedRepartidorId} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium disabled:opacity-50">Confirmar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
