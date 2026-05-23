import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, ShoppingCart, Trash2, Users, ClipboardList, Search, Eye } from 'lucide-react';
import { supabase } from '../../services/supabase';
import type { Cliente, Producto } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface CartItem {
  producto: Producto;
  cantidad: number | '';
}

interface PedidoProductoItem {
  cantidad: number;
  precio_unitario: number;
  producto: { nombre: string; imagen_url?: string | null } | null;
}

interface HistorialPedido {
  id: string;
  fecha: string;
  monto_total: number;
  estado: string;
  cliente: { id: string; nombre: string };
  pedido_producto: PedidoProductoItem[];
}

export default function VendedorDashboard() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  
  // Modals
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  
  // New Order states
  const [newOrderClienteId, setNewOrderClienteId] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  // New Client states
  const [nuevoCliente, setNuevoCliente] = useState({
    nombre: '',
    direccion: '',
    telefono: '',
    referencia: ''
  });
  const [isSavingClient, setIsSavingClient] = useState(false);

  // Tabs y Historial
  const [activeTab, setActiveTab] = useState<'nuevo' | 'historial'>('nuevo');
  const [historial, setHistorial] = useState<HistorialPedido[]>([]);
  const [historialSearch, setHistorialSearch] = useState('');
  const [isHistorialLoading, setIsHistorialLoading] = useState(false);
  const [selectedPedidoDetalle, setSelectedPedidoDetalle] = useState<HistorialPedido | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');

  const { profile, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!profile || profile.rol !== 'Vendedor')) {
      navigate('/login');
    }
  }, [profile, loading, navigate]);

  useEffect(() => {
    if (profile?.rol === 'Vendedor') {
      fetchClientes();
      fetchProductos();
    }
  }, [profile]);

  const fetchClientes = async () => {
    const { data, error } = await supabase.from('cliente').select('*');
    if (!error && data) setClientes(data);
  };

  const fetchProductos = async () => {
    const { data, error } = await supabase.from('producto').select('*').eq('estado', true);
    if (!error && data) setProductos(data);
  };

  const fetchHistorial = async () => {
    if (!profile?.id) return;
    setIsHistorialLoading(true);
    const { data, error } = await supabase
      .from('pedido')
      .select(`
        id,
        fecha,
        monto_total,
        estado,
        cliente ( id, nombre ),
        pedido_producto!relacion_almacen_oficial ( cantidad, precio_unitario, producto ( nombre, imagen_url ) )
      `)
      .eq('id_vendedor', profile.id)
      .order('fecha', { ascending: false });

    if (!error && data) {
      setHistorial(data as any[]);
    }
    setIsHistorialLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'historial') {
      fetchHistorial();
    }
  }, [activeTab]);

  // Funciones del Carrito

  const addToCartDirect = (prod: Producto) => {
    setCart(prevCart => {
      const existing = prevCart.find(item => item.producto.id === prod.id);
      if (existing) {
        const currentQ = typeof existing.cantidad === 'number' ? existing.cantidad : 0;
        if (currentQ + 1 > prod.stock) {
          alert(`Stock insuficiente. El máximo disponible para ${prod.nombre} es ${prod.stock}.`);
          return prevCart;
        }
        return prevCart.map(item => 
          item.producto.id === prod.id 
            ? { ...item, cantidad: currentQ + 1 }
            : item
        );
      } else {
        if (prod.stock < 1) {
          alert(`El producto ${prod.nombre} se encuentra agotado.`);
          return prevCart;
        }
        return [...prevCart, { producto: prod, cantidad: 1 }];
      }
    });
  };

  const removeFromCart = (idProducto: string | number) => {
    setCart(prevCart => prevCart.filter(item => item.producto.id !== idProducto));
  };

  const updateCartQuantity = (idProducto: string, newQuantity: number | '') => {
    setCart(prevCart => prevCart.map(item => {
      if (item.producto.id === idProducto) {
        if (typeof newQuantity === 'number' && newQuantity > item.producto.stock) {
          alert(`Stock insuficiente. El máximo disponible para ${item.producto.nombre} es ${item.producto.stock}.`);
          return { ...item, cantidad: item.producto.stock };
        }
        return { ...item, cantidad: newQuantity };
      }
      return item;
    }));
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => {
      const precio = item.producto.precio_unitario || 0;
      const cant = typeof item.cantidad === 'number' ? item.cantidad : 0;
      return total + (precio * cant);
    }, 0);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrderClienteId || cart.length === 0) {
      alert("Por favor selecciona un cliente y agrega al menos un producto.");
      return;
    }

    // Validación de stock antes de enviar a BD
    const exceedingProduct = cart.find(item => (typeof item.cantidad === 'number' ? item.cantidad : 0) > item.producto.stock);
    if (exceedingProduct) {
      alert(`No puedes pedir ${(typeof exceedingProduct.cantidad === 'number' ? exceedingProduct.cantidad : 0)} unidades de ${exceedingProduct.producto.nombre}. El stock disponible es ${exceedingProduct.producto.stock}.`);
      return;
    }

    setIsSavingOrder(true);
    const montoTotal = calculateTotal();

    try {
      const { data: pedidoInsertado, error: errorPedido } = await supabase
        .from('pedido')
        .insert([{
          id_cliente: newOrderClienteId,
          id_vendedor: profile?.id,
          monto_total: montoTotal
        }])
        .select()
        .single();

      if (errorPedido) {
        console.error("Error exacto devuelto por Supabase al crear pedido:", errorPedido);
        throw errorPedido;
      }

      const pedidoProductos = cart.map(item => ({
        id_pedido: pedidoInsertado.id,
        id_producto: item.producto.id,
        cantidad: typeof item.cantidad === 'number' ? item.cantidad : 1,
        precio_unitario: item.producto.precio_unitario
      }));

      const { error: errorDetalles } = await supabase
        .from('pedido_producto')
        .insert(pedidoProductos);

      if (errorDetalles) {
        console.error("Error al guardar detalles:", errorDetalles);
      }

      setIsNewOrderModalOpen(false);
      setNewOrderClienteId('');
      setCart([]);
      alert('¡Pedido creado exitosamente!');
    } catch (error: any) {
      console.error("Detalles del error en catch:", error);
      alert('Error al crear pedido. Revisa la consola para más detalles.');
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoCliente.nombre || !nuevoCliente.direccion) {
      alert("Nombre y dirección son obligatorios.");
      return;
    }

    setIsSavingClient(true);
    try {
      const { data, error } = await supabase
        .from('cliente')
        .insert([{
          nombre: nuevoCliente.nombre,
          direccion: nuevoCliente.direccion,
          telefono: nuevoCliente.telefono,
          referencia: nuevoCliente.referencia
        }])
        .select()
        .single();

      if (error) throw error;

      setClientes(prev => [...prev, data]);
      setIsNewClientModalOpen(false);
      setNuevoCliente({ nombre: '', direccion: '', telefono: '', referencia: '' });
      alert('¡Cliente registrado exitosamente!');
    } catch (error: any) {
      console.error(error.message || error);
      alert('Error al crear cliente');
    } finally {
      setIsSavingClient(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-slate-500">Cargando panel...</p></div>;
  if (!profile || profile.rol !== 'Vendedor') return null;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <header className="mb-8 flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Panel de Vendedor</h1>
          <p className="text-slate-500">Gestión de Clientes y Pedidos</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="font-semibold text-slate-700">{profile?.nombre || 'Cargando...'}</p>
            <p className="text-xs text-blue-600 font-medium bg-blue-50 inline-block px-2 py-0.5 rounded-full">{profile?.rol}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
            {profile?.nombre?.charAt(0).toUpperCase() || 'V'}
          </div>
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="flex border-b border-slate-200 mb-6 gap-2">
        <button
          onClick={() => setActiveTab('nuevo')}
          className={`py-3 px-6 font-medium text-sm transition-colors border-b-2 rounded-t-lg ${activeTab === 'nuevo' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
        >
          Nueva Gestión
        </button>
        <button
          onClick={() => setActiveTab('historial')}
          className={`py-3 px-6 font-medium text-sm transition-colors border-b-2 rounded-t-lg ${activeTab === 'historial' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
        >
          Historial de Pedidos
        </button>
      </div>

      {activeTab === 'nuevo' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-4">
              <Users size={32} />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Nuevo Cliente</h2>
            <p className="text-slate-500 mb-6">Registra un nuevo cliente en el sistema para poder tomarle pedidos.</p>
            <button 
              onClick={() => setIsNewClientModalOpen(true)}
              className="w-full max-w-xs flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl transition-colors font-medium shadow-sm active:scale-95"
            >
              <Plus size={18} />
              Registrar Cliente
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mb-4">
              <ClipboardList size={32} />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Nuevo Pedido</h2>
            <p className="text-slate-500 mb-6">Genera un nuevo pedido para un cliente existente.</p>
            <button 
              onClick={() => setIsNewOrderModalOpen(true)}
              className="w-full max-w-xs flex items-center justify-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white px-4 py-3 rounded-xl transition-colors font-medium shadow-sm active:scale-95"
            >
              <Plus size={18} />
              Crear Pedido
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-8">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-lg font-bold text-slate-800">Tus Pedidos</h2>
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Buscar por cliente o ID..."
                value={historialSearch}
                onChange={e => setHistorialSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all"
              />
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            </div>
          </div>

          {/* Filtros de estado */}
          <div className="px-5 pb-4 flex flex-wrap gap-2 border-b border-slate-100">
            {[
              { value: 'todos', label: 'Todos' },
              { value: 'pendiente', label: 'Pendiente' },
              { value: 'listo para despacho', label: 'Listo para Despacho' },
              { value: 'asignado', label: 'Asignado' },
              { value: 'en ruta', label: 'En Ruta' },
              { value: 'entregado', label: 'Entregado' },
              { value: 'incidencia', label: 'Incidencia' },
              { value: 'cancelado', label: 'Cancelado' },
            ].map(f => (
              <button
                key={f.value}
                onClick={() => setFiltroEstado(f.value)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                  filtroEstado === f.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          
          {isHistorialLoading ? (
            <div className="p-8 text-center text-slate-400">Cargando historial...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="p-4 font-medium">Fecha</th>
                    <th className="p-4 font-medium">Cliente</th>
                    <th className="p-4 font-medium">Total</th>
                    <th className="p-4 font-medium">Estado</th>
                    <th className="p-4 font-medium text-right">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historial
                    .filter(h => {
                      const matchSearch = historialSearch === '' ||
                        h.cliente?.nombre?.toLowerCase().includes(historialSearch.toLowerCase()) ||
                        h.id.toLowerCase().includes(historialSearch.toLowerCase());
                      const matchEstado = filtroEstado === 'todos' ||
                        h.estado?.toLowerCase() === filtroEstado;
                      return matchSearch && matchEstado;
                    })
                    .map(pedido => (
                      <tr key={pedido.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 whitespace-nowrap text-slate-600">
                          {new Date(pedido.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-4 font-medium text-slate-800">{pedido.cliente?.nombre || 'Desconocido'}</td>
                        <td className="p-4 font-bold text-emerald-600">S/ {pedido.monto_total.toFixed(2)}</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            pedido.estado?.toLowerCase() === 'pendiente' ? 'bg-amber-100 text-amber-700' :
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
                        <td className="p-4 text-right">
                          <button
                            onClick={() => setSelectedPedidoDetalle(pedido)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-flex items-center"
                            title="Ver detalle"
                          >
                            <Eye size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  {historial.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400">No has registrado pedidos aún.</td></tr>
                  )}
                  {historial.length > 0 && historial.filter(h => {
                    const matchSearch = historialSearch === '' ||
                      h.cliente?.nombre?.toLowerCase().includes(historialSearch.toLowerCase()) ||
                      h.id.toLowerCase().includes(historialSearch.toLowerCase());
                    const matchEstado = filtroEstado === 'todos' || h.estado?.toLowerCase() === filtroEstado;
                    return matchSearch && matchEstado;
                  }).length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400">No tienes pedidos en este estado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: Nuevo Cliente */}
      {isNewClientModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-800">Registrar Nuevo Cliente</h3>
              <button onClick={() => setIsNewClientModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
            <form onSubmit={handleCreateClient} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del cliente *</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={nuevoCliente.nombre}
                  onChange={e => setNuevoCliente({...nuevoCliente, nombre: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Dirección *</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={nuevoCliente.direccion}
                  onChange={e => setNuevoCliente({...nuevoCliente, direccion: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                <input 
                  type="tel" 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={nuevoCliente.telefono}
                  onChange={e => setNuevoCliente({...nuevoCliente, telefono: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Referencia (opcional)</label>
                <input 
                  type="text" 
                  placeholder="Ej: Frente al parque"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={nuevoCliente.referencia}
                  onChange={e => setNuevoCliente({...nuevoCliente, referencia: e.target.value})}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsNewClientModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium">Cancelar</button>
                <button type="submit" disabled={isSavingClient} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium disabled:opacity-50">
                  {isSavingClient ? 'Guardando...' : 'Guardar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Nuevo Pedido */}
      {isNewOrderModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <ShoppingCart size={20} className="text-[var(--color-primary)]" />
                Crear Nuevo Pedido
              </h3>
              <button onClick={() => setIsNewOrderModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">1. Cliente Destino</label>
                  <select 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    value={newOrderClienteId}
                    onChange={(e) => setNewOrderClienteId(e.target.value)}
                    required
                  >
                    <option value="" disabled>-- Selecciona el cliente --</option>
                    {clientes.map(cli => (
                      <option key={cli.id} value={cli.id}>{cli.nombre} - {cli.direccion}</option>
                    ))}
                  </select>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <label className="block text-sm font-medium text-slate-700 mb-2">2. Selecciona los Productos (Clic para agregar)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4 max-h-72 overflow-y-auto p-1">
                    {productos.map(prod => (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => addToCartDirect(prod)}
                        className={`bg-white border rounded-xl overflow-hidden hover:shadow-md transition-all text-left flex flex-col group relative ${
                          cart.find(c => c.producto.id === prod.id) 
                            ? 'border-blue-500 ring-1 ring-blue-500' 
                            : 'border-slate-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="aspect-square bg-slate-100 w-full relative overflow-hidden">
                          <img 
                            src={prod.imagen_url || 'https://placehold.co/200x200/f8fafc/64748b?text=Sin+Foto'} 
                            alt={prod.nombre}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute top-1.5 right-1.5 bg-slate-900/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
                            Stock: {prod.stock}
                          </div>
                          {cart.find(c => c.producto.id === prod.id) && (
                            <div className="absolute top-2 right-2 bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-sm">
                              {cart.find(c => c.producto.id === prod.id)?.cantidad}
                            </div>
                          )}
                        </div>
                        <div className="p-2.5">
                          <p className="font-semibold text-slate-700 text-xs line-clamp-2 leading-tight">{prod.nombre}</p>
                          <p className="text-blue-600 font-bold text-sm mt-1">S/ {prod.precio_unitario?.toFixed(2)}</p>
                        </div>
                      </button>
                    ))}
                  </div>

                  {cart.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <th className="p-2 font-medium">Producto</th>
                            <th className="p-2 font-medium text-center">Cant.</th>
                            <th className="p-2 font-medium text-right">Subtotal</th>
                            <th className="p-2 font-medium"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {cart.map((item) => (
                            <tr key={item.producto.id}>
                              <td className="p-2">
                                <div className="flex items-center gap-2">
                                  <img 
                                    src={item.producto.imagen_url || 'https://placehold.co/50x50/f8fafc/64748b?text=Foto'} 
                                    className="w-8 h-8 rounded bg-slate-100 object-cover border border-slate-200" 
                                    alt=""
                                  />
                                  <span className="text-slate-700 font-medium">{item.producto.nombre}</span>
                                </div>
                              </td>
                              <td className="p-2 text-center">
                                <input 
                                  type="number" 
                                  min="1"
                                  value={item.cantidad}
                                  onChange={(e) => updateCartQuantity(item.producto.id, e.target.value === '' ? '' : parseInt(e.target.value))}
                                  onBlur={(e) => {
                                    if (e.target.value === '' || parseInt(e.target.value) < 1) {
                                      updateCartQuantity(item.producto.id, 1);
                                    }
                                  }}
                                  className="w-16 text-center border border-slate-200 rounded px-1 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                                />
                              </td>
                              <td className="p-2 text-right">
                                S/ {((item.producto.precio_unitario || 0) * (typeof item.cantidad === 'number' ? item.cantidad : 0)).toFixed(2)}
                              </td>
                              <td className="p-2 text-right">
                                <button 
                                  type="button"
                                  onClick={() => removeFromCart(item.producto.id)}
                                  className="text-red-400 hover:text-red-600 p-1"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t border-slate-200">
                          <tr>
                            <td colSpan={2} className="p-3 text-right font-bold text-slate-700">TOTAL:</td>
                            <td className="p-3 text-right font-bold text-[var(--color-primary)]">
                              S/ {calculateTotal().toFixed(2)}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-white">
              <button 
                type="button" 
                onClick={() => setIsNewOrderModalOpen(false)}
                className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
              >
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={handleCreateOrder}
                disabled={!newOrderClienteId || cart.length === 0 || isSavingOrder}
                className="px-6 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white rounded-xl font-medium disabled:opacity-50"
              >
                {isSavingOrder ? 'Guardando...' : 'Crear Pedido'}
              </button>
            </div>
          </div>
        </div>
      )}

    {/* Modal: Detalle de Historial */}
      {selectedPedidoDetalle && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">Detalle del Pedido #{selectedPedidoDetalle.id.substring(0,8)}</h3>
              <button onClick={() => setSelectedPedidoDetalle(null)} className="text-slate-400 hover:text-slate-600">
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
            <div className="p-5">
              <div className="flex justify-between items-start mb-4 pb-4 border-b border-slate-100">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Cliente</p>
                  <p className="font-bold text-slate-800">{selectedPedidoDetalle.cliente?.nombre || 'Desconocido'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500 mb-1">Total</p>
                  <p className="font-bold text-emerald-600 text-lg">S/ {selectedPedidoDetalle.monto_total.toFixed(2)}</p>
                </div>
              </div>
              
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Productos</h4>
              <ul className="space-y-3 max-h-60 overflow-y-auto">
                {selectedPedidoDetalle.pedido_producto?.map((prod, i) => (
                  <li key={i} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <img 
                        src={prod.producto?.imagen_url || 'https://placehold.co/40x40/f8fafc/64748b?text=Foto'} 
                        alt={prod.producto?.nombre}
                        className="w-8 h-8 rounded-md object-cover border border-slate-200 flex-shrink-0"
                      />
                      <span className="font-medium text-slate-700">{prod.producto?.nombre || 'Desconocido'}</span>
                    </div>
                    <div className="text-sm text-slate-500 font-medium">
                      x{prod.cantidad} <span className="text-slate-400 font-normal">| S/ {prod.precio_unitario.toFixed(2)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setSelectedPedidoDetalle(null)}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
