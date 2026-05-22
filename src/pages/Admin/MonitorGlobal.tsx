import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  LogOut, Search, Package, Users, X, Loader2,
  Truck, CheckCircle, AlertTriangle, Clock, XCircle,
  ShieldAlert, LayoutList, UserCircle2
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import type { OrderStatus, UserRole } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface PedidoDetallado {
  id: string;
  fecha: string;
  estado: OrderStatus;
  monto_total: number;
  cliente: { nombre: string } | null;
  vendedor: { nombre: string } | null;
  repartidor: { nombre: string; id: string } | null;
}

interface RepartidorOpt {
  id: string;
  nombre: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  'pendiente':           { label: 'Pendiente',           color: 'bg-amber-100 text-amber-700',   icon: <Clock size={12} /> },
  'listo para despacho': { label: 'Listo p/ Despacho',   color: 'bg-blue-100 text-blue-700',     icon: <Package size={12} /> },
  'asignado':            { label: 'Asignado',             color: 'bg-indigo-100 text-indigo-700', icon: <UserCircle2 size={12} /> },
  'en ruta':             { label: 'En Ruta',              color: 'bg-sky-100 text-sky-700',       icon: <Truck size={12} /> },
  'entregado':           { label: 'Entregado',            color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle size={12} /> },
  'incidencia':          { label: 'Incidencia',           color: 'bg-red-100 text-red-700',       icon: <AlertTriangle size={12} /> },
  'cancelado':           { label: 'Cancelado',            color: 'bg-slate-100 text-slate-500',   icon: <XCircle size={12} /> },
};

const ALL_STATUSES: OrderStatus[] = [
  'Pendiente', 'Listo para Despacho', 'Asignado', 'En ruta', 'Entregado', 'Incidencia', 'Cancelado'
];

export default function MonitorGlobal() {
  const [pedidos, setPedidos] = useState<PedidoDetallado[]>([]);
  const [repartidores, setRepartidores] = useState<RepartidorOpt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('Todos');

  // Modal de emergencia
  const [selectedPedido, setSelectedPedido] = useState<PedidoDetallado | null>(null);
  const [emergencyEstado, setEmergencyEstado] = useState<OrderStatus>('Pendiente');
  const [emergencyRepartidorId, setEmergencyRepartidorId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const { profile, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!profile || profile.rol !== 'Administrador')) {
      navigate('/login');
    }
  }, [profile, loading, navigate]);

  useEffect(() => {
    if (profile?.rol === 'Administrador') {
      fetchPedidos();
      fetchRepartidores();
      
      const channel = supabase.channel('monitor-pedidos-admin')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'pedido' },
          () => {
            fetchPedidos(); // Actualizar automáticamente cuando un pedido cambie
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [profile]);

  const fetchPedidos = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('pedido')
      .select(`
        id, fecha, estado, monto_total,
        cliente:id_cliente ( nombre ),
        vendedor:id_vendedor ( nombre ),
        repartidor:id_repartidor ( id, nombre )
      `)
      .order('fecha', { ascending: false });

    if (error) console.error('Error fetching pedidos:', error.message);
    if (data) setPedidos(data as unknown as PedidoDetallado[]);
    setIsLoading(false);
  };

  const fetchRepartidores = async () => {
    const { data } = await supabase
      .from('usuario')
      .select('id, nombre')
      .eq('rol', 'Repartidor' as UserRole)
      .eq('activo', true);
    if (data) setRepartidores(data);
  };

  const openEmergencyModal = (pedido: PedidoDetallado) => {
    setSelectedPedido(pedido);
    setEmergencyEstado(pedido.estado);
    setEmergencyRepartidorId(pedido.repartidor?.id ?? '');
  };

  const handleEmergencySave = async () => {
    if (!selectedPedido) return;
    setIsSaving(true);
    try {
      const updatePayload: Record<string, unknown> = { estado: emergencyEstado };
      if (emergencyRepartidorId) updatePayload.id_repartidor = emergencyRepartidorId;

      const { error } = await supabase
        .from('pedido')
        .update(updatePayload)
        .eq('id', selectedPedido.id);

      if (error) throw error;

      // Actualizar local
      setPedidos(prev => prev.map(p =>
        p.id === selectedPedido.id
          ? {
              ...p,
              estado: emergencyEstado,
              repartidor: emergencyRepartidorId
                ? (repartidores.find(r => r.id === emergencyRepartidorId)
                    ? { id: emergencyRepartidorId, nombre: repartidores.find(r => r.id === emergencyRepartidorId)!.nombre }
                    : p.repartidor)
                : p.repartidor
            }
          : p
      ));
      setSelectedPedido(null);
    } catch (err: any) {
      alert(`Error al guardar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-500">Cargando panel...</p>
    </div>
  );
  if (!profile || profile.rol !== 'Administrador') return null;

  // Filtros
  const pedidosFiltrados = pedidos.filter(p => {
    const matchSearch =
      p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.cliente?.nombre ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.vendedor?.nombre ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.repartidor?.nombre ?? '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchStatus = filterStatus === 'Todos' || p.estado?.toLowerCase() === filterStatus.toLowerCase();
    return matchSearch && matchStatus;
  });

  const kpis = {
    total: pedidos.length,
    enRuta: pedidos.filter(p => p.estado?.toLowerCase() === 'en ruta').length,
    entregados: pedidos.filter(p => p.estado?.toLowerCase() === 'entregado').length,
    incidencias: pedidos.filter(p => p.estado?.toLowerCase() === 'incidencia').length,
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      {/* Header */}
      <header className="mb-6 flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Panel de Administrador</h1>
          <p className="text-slate-500 text-sm">Monitor Global de Pedidos</p>
        </div>
        <div className="flex items-center gap-3">
          <nav className="hidden sm:flex gap-1 mr-2">
            <Link to="/admin" className="px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1.5"><Package size={16} /> Productos</Link>
            <Link to="/admin/usuarios" className="px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1.5"><Users size={16} /> Personal</Link>
            <Link to="/admin/clientes" className="px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1.5"><UserCircle2 size={16} /> Clientes</Link>
            <Link to="/admin/monitor" className="px-3 py-2 text-sm font-medium text-violet-700 bg-violet-100 rounded-xl transition-colors flex items-center gap-1.5"><LayoutList size={16} /> Monitor</Link>
          </nav>
          <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-sm">
            {profile?.nombre?.charAt(0).toUpperCase() || 'A'}
          </div>
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><LogOut size={18} /></button>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Pedidos', value: kpis.total,      bg: 'bg-violet-100', text: 'text-violet-600', Icon: LayoutList },
          { label: 'En Ruta',       value: kpis.enRuta,     bg: 'bg-sky-100',    text: 'text-sky-600',    Icon: Truck },
          { label: 'Entregados',    value: kpis.entregados, bg: 'bg-emerald-100',text: 'text-emerald-600',Icon: CheckCircle },
          { label: 'Incidencias',   value: kpis.incidencias,bg: 'bg-red-100',    text: 'text-red-600',    Icon: AlertTriangle },
        ].map(({ label, value, bg, text, Icon }) => (
          <div key={label} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center gap-3">
            <div className={`p-2.5 ${bg} ${text} rounded-xl`}><Icon size={20} /></div>
            <div><p className="text-xs text-slate-500">{label}</p><p className={`text-2xl font-bold ${text}`}>{value}</p></div>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
          <h2 className="text-base font-semibold text-slate-800">Historial Completo</h2>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {/* Buscador */}
            <div className="relative flex-1 sm:flex-initial">
              <input
                type="text"
                placeholder="ID, cliente, vendedor, repartidor..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full sm:w-72 pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            </div>
            {/* Filtro estado */}
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white"
            >
              <option value="Todos">Todos los estados</option>
              {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={28} className="animate-spin mr-2" /><p>Cargando historial...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="p-4 font-medium">ID Pedido</th>
                  <th className="p-4 font-medium">Cliente</th>
                  <th className="p-4 font-medium">Vendedor</th>
                  <th className="p-4 font-medium">Repartidor</th>
                  <th className="p-4 font-medium">Estado</th>
                  <th className="p-4 font-medium">Monto</th>
                  <th className="p-4 font-medium">Fecha</th>
                  <th className="p-4 font-medium text-right">Emergencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pedidosFiltrados.length === 0 ? (
                  <tr><td colSpan={8} className="p-10 text-center text-slate-400">No se encontraron pedidos.</td></tr>
                ) : pedidosFiltrados.map(pedido => {
                  const sc = STATUS_CONFIG[pedido.estado?.toLowerCase()] ?? STATUS_CONFIG['pendiente'];
                  return (
                    <tr key={pedido.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 font-mono text-xs text-slate-500">#{pedido.id.substring(0, 8)}</td>
                      <td className="p-4 font-medium text-slate-700">{pedido.cliente?.nombre ?? '—'}</td>
                      <td className="p-4 text-slate-500">{pedido.vendedor?.nombre ?? '—'}</td>
                      <td className="p-4 text-slate-500">{pedido.repartidor?.nombre ?? <span className="text-slate-300">Sin asignar</span>}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${sc.color}`}>
                          {sc.icon}{sc.label}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-slate-700">S/ {pedido.monto_total.toFixed(2)}</td>
                      <td className="p-4 text-slate-400 text-xs">{new Date(pedido.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => openEmergencyModal(pedido)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          <ShieldAlert size={14} /> Forzar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Edición de Emergencia */}
      {selectedPedido && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50" onClick={() => setSelectedPedido(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-red-50">
              <h3 className="font-bold text-lg text-red-800 flex items-center gap-2">
                <ShieldAlert size={20} /> Edición de Emergencia
              </h3>
              <button onClick={() => setSelectedPedido(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            <div className="p-5 space-y-5">
              <div className="p-3 bg-slate-50 rounded-xl text-sm">
                <p className="text-slate-500">Pedido <span className="font-mono font-bold text-slate-700">#{selectedPedido.id.substring(0, 8)}</span></p>
                <p className="text-slate-500">Cliente: <span className="font-medium text-slate-700">{selectedPedido.cliente?.nombre ?? '—'}</span></p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Forzar Estado</label>
                <select
                  value={emergencyEstado}
                  onChange={e => setEmergencyEstado(e.target.value as OrderStatus)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent text-sm"
                >
                  {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Reasignar Repartidor</label>
                <select
                  value={emergencyRepartidorId}
                  onChange={e => setEmergencyRepartidorId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent text-sm"
                >
                  <option value="">— Mantener actual —</option>
                  {repartidores.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
                ⚠️ Esta acción sobreescribe el estado actual sin restricciones de negocio. Úsala solo en emergencias.
              </div>

              <div className="flex gap-3 justify-end">
                <button onClick={() => setSelectedPedido(null)} className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors text-sm">Cancelar</button>
                <button
                  onClick={handleEmergencySave}
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors text-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving ? <><Loader2 size={14} className="animate-spin" /> Guardando...</> : <><ShieldAlert size={14} /> Confirmar</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
