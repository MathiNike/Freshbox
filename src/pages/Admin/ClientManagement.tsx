import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  LogOut, Search, Package, Users, Pencil, PowerOff, Power,
  X, Loader2, UserCircle2, Phone, MapPin, Plus, LayoutList
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import type { Cliente } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';

// Extender el tipo con la columna 'activo' que añadimos en Supabase
interface ClienteConActivo extends Cliente {
  activo: boolean;
}

const emptyForm = {
  nombre: '',
  telefono: '',
  direccion: '',
  referencia: '',
};

export default function ClientManagement() {
  const [clientes, setClientes] = useState<ClienteConActivo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [soloActivos, setSoloActivos] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { profile, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!profile || profile.rol !== 'Administrador')) {
      navigate('/login');
    }
  }, [profile, loading, navigate]);

  useEffect(() => {
    if (profile?.rol === 'Administrador') fetchClientes();
  }, [profile]);

  const fetchClientes = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('cliente')
      .select('*')
      .order('nombre', { ascending: true });

    if (error) console.error('Error fetching clientes:', error.message);
    if (data) setClientes(data as ClienteConActivo[]);
    setIsLoading(false);
  };

  // CREATE
  const handleCreate = async () => {
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('cliente')
        .insert([{
          nombre: form.nombre.trim(),
          telefono: form.telefono.trim() || null,
          direccion: form.direccion.trim(),
          referencia: form.referencia.trim() || null,
          activo: true,
        }])
        .select()
        .single();

      if (error) throw error;
      setClientes(prev => [...prev, data as ClienteConActivo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      closeModal();
    } catch (err: any) {
      alert(`Error al crear cliente: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // UPDATE
  const handleUpdate = async () => {
    if (!editingId) return;
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('cliente')
        .update({
          nombre: form.nombre.trim(),
          telefono: form.telefono.trim() || null,
          direccion: form.direccion.trim(),
          referencia: form.referencia.trim() || null,
        })
        .eq('id', editingId)
        .select()
        .single();

      if (error) throw error;
      setClientes(prev =>
        prev.map(c => c.id === editingId ? { ...c, ...(data as ClienteConActivo) } : c)
          .sort((a, b) => a.nombre.localeCompare(b.nombre))
      );
      closeModal();
    } catch (err: any) {
      alert(`Error al actualizar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // SOFT DELETE (toggle activo)
  const handleToggleActivo = async (cliente: ClienteConActivo) => {
    const nuevoEstado = !cliente.activo;
    const accion = nuevoEstado ? 'activar' : 'desactivar';
    if (!window.confirm(`¿Confirmas ${accion} al cliente "${cliente.nombre}"?\n${!nuevoEstado ? 'Sus pedidos históricos no se verán afectados.' : ''}`)) return;

    const { error } = await supabase
      .from('cliente')
      .update({ activo: nuevoEstado })
      .eq('id', cliente.id);

    if (error) { alert(`Error: ${error.message}`); return; }
    setClientes(prev => prev.map(c => c.id === cliente.id ? { ...c, activo: nuevoEstado } : c));
  };

  const openCreateModal = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = (cliente: ClienteConActivo) => {
    setEditingId(cliente.id);
    setForm({
      nombre: cliente.nombre,
      telefono: cliente.telefono ?? '',
      direccion: cliente.direccion,
      referencia: cliente.referencia ?? '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim() || !form.direccion.trim()) {
      alert('Nombre y dirección son obligatorios.'); return;
    }
    editingId ? handleUpdate() : handleCreate();
  };

  const handleLogout = async () => { await signOut(); navigate('/login'); };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-slate-500">Cargando...</p></div>;
  if (!profile || profile.rol !== 'Administrador') return null;

  const clientesFiltrados = clientes
    .filter(c => soloActivos ? c.activo !== false : true)
    .filter(c =>
      c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.telefono ?? '').includes(searchTerm) ||
      c.direccion.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const stats = {
    total: clientes.length,
    activos: clientes.filter(c => c.activo !== false).length,
    inactivos: clientes.filter(c => c.activo === false).length,
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      {/* Header */}
      <header className="mb-6 flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Panel de Administrador</h1>
          <p className="text-slate-500 text-sm">Gestión de Clientes</p>
        </div>
        <div className="flex items-center gap-3">
          <nav className="hidden sm:flex gap-1 mr-2">
            <Link to="/admin" className="px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1.5"><Package size={16} /> Productos</Link>
            <Link to="/admin/usuarios" className="px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1.5"><Users size={16} /> Personal</Link>
            <Link to="/admin/clientes" className="px-3 py-2 text-sm font-medium text-violet-700 bg-violet-100 rounded-xl transition-colors flex items-center gap-1.5"><UserCircle2 size={16} /> Clientes</Link>
            <Link to="/admin/monitor" className="px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1.5"><LayoutList size={16} /> Monitor</Link>
          </nav>
          <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-sm">
            {profile?.nombre?.charAt(0).toUpperCase() || 'A'}
          </div>
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><LogOut size={18} /></button>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center gap-3">
          <div className="p-2.5 bg-violet-100 text-violet-600 rounded-xl"><UserCircle2 size={20} /></div>
          <div><p className="text-xs text-slate-500">Total</p><p className="text-2xl font-bold">{stats.total}</p></div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-xl"><Power size={20} /></div>
          <div><p className="text-xs text-slate-500">Activos</p><p className="text-2xl font-bold text-emerald-600">{stats.activos}</p></div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center gap-3">
          <div className="p-2.5 bg-slate-100 text-slate-500 rounded-xl"><PowerOff size={20} /></div>
          <div><p className="text-xs text-slate-500">Inactivos</p><p className="text-2xl font-bold text-slate-500">{stats.inactivos}</p></div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
          <h2 className="text-base font-semibold text-slate-800">Listado de Clientes</h2>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <input
                type="text"
                placeholder="Nombre, teléfono, dirección..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full sm:w-64 pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
              <input type="checkbox" checked={soloActivos} onChange={e => setSoloActivos(e.target.checked)} className="rounded" />
              Solo activos
            </label>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium text-sm transition-colors"
            >
              <Plus size={16} /> Nuevo Cliente
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={28} className="animate-spin mr-2" /><p>Cargando clientes...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="p-4 font-medium">Cliente</th>
                  <th className="p-4 font-medium">Teléfono</th>
                  <th className="p-4 font-medium">Dirección</th>
                  <th className="p-4 font-medium">Estado</th>
                  <th className="p-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clientesFiltrados.length === 0 ? (
                  <tr><td colSpan={5} className="p-10 text-center text-slate-400">No se encontraron clientes.</td></tr>
                ) : clientesFiltrados.map(cliente => (
                  <tr key={cliente.id} className={`hover:bg-slate-50/50 transition-colors ${cliente.activo === false ? 'opacity-50' : ''}`}>
                    <td className="p-4">
                      <p className="font-medium text-slate-700">{cliente.nombre}</p>
                      {cliente.referencia && <p className="text-xs text-slate-400 mt-0.5">{cliente.referencia}</p>}
                    </td>
                    <td className="p-4 text-slate-500">
                      {cliente.telefono
                        ? <span className="inline-flex items-center gap-1"><Phone size={12} />{cliente.telefono}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="p-4 text-slate-500">
                      <span className="inline-flex items-start gap-1"><MapPin size={12} className="mt-0.5 shrink-0" />{cliente.direccion}</span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${cliente.activo !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {cliente.activo !== false ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(cliente)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-violet-50 text-violet-600 hover:bg-violet-100 rounded-lg transition-colors"
                        >
                          <Pencil size={12} /> Editar
                        </button>
                        <button
                          onClick={() => handleToggleActivo(cliente)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            cliente.activo !== false
                              ? 'bg-red-50 text-red-600 hover:bg-red-100'
                              : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                          }`}
                        >
                          {cliente.activo !== false ? <><PowerOff size={12} /> Desactivar</> : <><Power size={12} /> Activar</>}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-violet-50">
              <h3 className="font-bold text-lg text-violet-800 flex items-center gap-2">
                {editingId ? <><Pencil size={18} /> Editar Cliente</> : <><Plus size={18} /> Nuevo Cliente</>}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo *</label>
                <input type="text" required placeholder="Ej: María García" value={form.nombre}
                  onChange={e => setForm({ ...form, nombre: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                <input type="tel" placeholder="Ej: 965 123 456" value={form.telefono}
                  onChange={e => setForm({ ...form, telefono: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Dirección (Iquitos) *</label>
                <input type="text" required placeholder="Ej: Av. La Marina 123, Punchana" value={form.direccion}
                  onChange={e => setForm({ ...form, direccion: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Referencia</label>
                <input type="text" placeholder="Ej: Frente al parque" value={form.referencia}
                  onChange={e => setForm({ ...form, referencia: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm" />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-medium text-sm">Cancelar</button>
                <button type="submit" disabled={isSaving}
                  className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium text-sm disabled:opacity-50 flex items-center gap-2">
                  {isSaving ? <><Loader2 size={14} className="animate-spin" /> Guardando...</> : (editingId ? 'Guardar Cambios' : 'Crear Cliente')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
