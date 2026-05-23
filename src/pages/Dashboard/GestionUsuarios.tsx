import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Pencil, LogOut, X, Loader2, Users, Search, Package, Power, PowerOff, UserCircle2, LayoutList, Key } from 'lucide-react';
import { supabase } from '../../services/supabase';
import type { Usuario, UserRole } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';

const emptyForm = {
  nombre: '',
  email: '',
  password: '',
  rol: 'Vendedor' as UserRole,
};

export default function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { profile, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!profile || profile.rol !== 'Administrador')) {
      navigate('/login');
    }
  }, [profile, loading, navigate]);

  useEffect(() => {
    if (profile?.rol === 'Administrador') {
      fetchUsuarios();
    }
  }, [profile]);

  const fetchUsuarios = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('usuario')
      .select('*')
      .order('nombre', { ascending: true });

    if (error) {
      console.error('Error fetching usuarios:', error.message);
    }
    if (data) {
      setUsuarios(data);
    }
    setIsLoading(false);
  };

  const handleCreate = async () => {
    setIsSaving(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('crear-usuario-admin', {
        body: {
          email: form.email.trim(),
          password: form.password,
          nombre_completo: form.nombre.trim(),
          rol: form.rol
        }
      });

      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);

      // Esperar brevemente a que el trigger de Supabase inserte el registro en public.usuario y recargar
      setTimeout(() => fetchUsuarios(), 500);

      closeModal();
      alert('¡Usuario creado exitosamente!');
    } catch (error: any) {
      console.error('Error al crear usuario:', error.message);
      alert(`Error al crear usuario: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingUserId) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('usuario')
        .update({
          nombre: form.nombre.trim(),
          rol: form.rol
        })
        .eq('id', editingUserId);

      if (error) throw error;

      setUsuarios(prev =>
        prev.map(u => u.id === editingUserId ? { ...u, nombre: form.nombre.trim(), rol: form.rol } : u)
          .sort((a, b) => a.nombre.localeCompare(b.nombre))
      );
      closeModal();
      alert('¡Usuario actualizado!');
    } catch (error: any) {
      console.error('Error al actualizar usuario:', error.message);
      alert(`Error al actualizar: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPassword = async (usuario: Usuario) => {
    const newPassword = window.prompt(`Escribe la nueva contraseña para ${usuario.nombre} (mínimo 6 caracteres):`);
    
    if (newPassword === null) return; // El usuario canceló
    if (newPassword.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (!window.confirm(`¿Estás seguro de que deseas cambiar la contraseña de ${usuario.nombre}?`)) return;

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('crear-usuario-admin', {
        body: {
          action: 'update_password',
          userId: usuario.id,
          password: newPassword
        }
      });

      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);

      alert(`Contraseña de ${usuario.nombre} restablecida con éxito.`);
    } catch (error: any) {
      console.error('Error al restablecer contraseña:', error.message);
      alert(`Error al restablecer contraseña: ${error.message}`);
    }
  };

  const handleToggleEstado = async (usuario: Usuario) => {
    // Si usuario.activo es undefined (registros antiguos), asumimos que es true
    const nuevoEstado = usuario.activo === false ? true : false;
    const accion = nuevoEstado ? 'activar' : 'inhabilitar';

    if (!window.confirm(`¿Estás seguro de que deseas ${accion} a ${usuario.nombre}?`)) {
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('usuario')
        .update({ activo: nuevoEstado })
        .eq('id', usuario.id);

      if (error) throw error;

      setUsuarios(prev =>
        prev.map(u => u.id === usuario.id ? { ...u, activo: nuevoEstado } : u)
      );
    } catch (error: any) {
      console.error(`Error al ${accion} usuario:`, error.message);
      alert(`Error al ${accion}: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingUserId(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = (usuario: Usuario) => {
    setEditingUserId(usuario.id);
    setForm({
      nombre: usuario.nombre,
      email: usuario.email,
      password: '',
      rol: usuario.rol,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUserId(null);
    setForm(emptyForm);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim() || (!editingUserId && (!form.email.trim() || !form.password))) {
      alert('Nombre, correo y contraseña son obligatorios para usuarios nuevos.');
      return;
    }
    if (editingUserId) {
      handleUpdate();
    } else {
      handleCreate();
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-slate-500">Cargando panel...</p></div>;
  if (!profile || profile.rol !== 'Administrador') return null;

  const usuariosFiltrados = usuarios.filter(u =>
    u.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: usuarios.length,
    repartidores: usuarios.filter(u => u.rol === 'Repartidor').length,
    vendedores: usuarios.filter(u => u.rol === 'Vendedor').length,
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <header className="mb-6 md:mb-8 flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Panel de Administrador</h1>
          <p className="text-slate-500 text-sm md:text-base">Gestión de Usuarios</p>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          <nav className="hidden sm:flex gap-1 mr-2">
            <Link to="/admin" className="px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1.5"><Package size={16} /> Productos</Link>
            <Link to="/admin/usuarios" className="px-3 py-2 text-sm font-medium text-violet-700 bg-violet-100 rounded-xl transition-colors flex items-center gap-1.5"><Users size={16} /> Personal</Link>
            <Link to="/admin/clientes" className="px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1.5"><UserCircle2 size={16} /> Clientes</Link>
            <Link to="/admin/monitor" className="px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1.5"><LayoutList size={16} /> Monitor</Link>
          </nav>
          <div className="text-right hidden md:block">
            <p className="font-semibold text-slate-700">{profile?.nombre || 'Cargando...'}</p>
            <p className="text-xs text-violet-600 font-medium bg-violet-50 inline-block px-2 py-0.5 rounded-full">{profile?.rol}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-bold">
            {profile?.nombre?.charAt(0).toUpperCase() || 'A'}
          </div>
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 md:mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
          <div className="p-3 bg-violet-100 text-violet-600 rounded-xl"><Users size={24} /></div>
          <div><p className="text-sm text-slate-500">Total Usuarios</p><p className="text-2xl font-bold">{stats.total}</p></div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><Users size={24} /></div>
          <div><p className="text-sm text-slate-500">Repartidores</p><p className="text-2xl font-bold text-blue-600">{stats.repartidores}</p></div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><Users size={24} /></div>
          <div><p className="text-sm text-slate-500">Vendedores</p><p className="text-2xl font-bold text-emerald-600">{stats.vendedores}</p></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 md:p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-800">Directorio de Personal</h2>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <input
                type="text"
                placeholder="Buscar por nombre o correo..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full sm:w-64 pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all text-sm"
              />
              <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            </div>
            <button
              onClick={openCreateModal}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors shadow-sm active:scale-[0.98] text-sm"
            >
              <Plus size={18} /> Nuevo Usuario
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={32} className="animate-spin mr-2" />
            <p>Cargando usuarios...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm">
                  <th className="p-4 font-medium">Nombre</th>
                  <th className="p-4 font-medium">Correo Electrónico</th>
                  <th className="p-4 font-medium">Rol</th>
                  <th className="p-4 font-medium">Estado</th>
                  <th className="p-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usuariosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      {searchTerm ? 'No se encontraron usuarios.' : 'No hay usuarios registrados.'}
                    </td>
                  </tr>
                ) : usuariosFiltrados.map(usuario => (
                  <tr key={usuario.id} className={`hover:bg-slate-50/50 transition-colors ${usuario.activo === false ? 'opacity-50' : ''}`}>
                    <td className="p-4">
                      <p className="font-medium text-slate-700">{usuario.nombre}</p>
                    </td>
                    <td className="p-4 text-slate-500">{usuario.email}</td>
                    <td className="p-4">
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-sm font-bold ${
                        usuario.rol === 'Administrador' ? 'bg-red-100 text-red-700' :
                        usuario.rol === 'Supervisor' ? 'bg-amber-100 text-amber-700' :
                        usuario.rol === 'Repartidor' ? 'bg-blue-100 text-blue-700' :
                        usuario.rol === 'Almacen' ? 'bg-slate-100 text-slate-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {usuario.rol}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        usuario.activo !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {usuario.activo !== false ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(usuario)}
                          className="text-violet-600 hover:text-violet-800 font-medium text-sm bg-violet-50 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1"
                        >
                          <Pencil size={14} /> Editar
                        </button>
                        <button
                          onClick={() => handleResetPassword(usuario)}
                          className="text-blue-600 hover:text-blue-800 font-medium text-sm bg-blue-50 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1"
                          title="Restablecer Contraseña"
                        >
                          <Key size={14} /> Clave
                        </button>
                        <button
                          onClick={() => handleToggleEstado(usuario)}
                          className={`font-medium text-sm px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1 ${
                            usuario.activo !== false
                              ? 'text-amber-600 hover:text-amber-800 bg-amber-50'
                              : 'text-emerald-600 hover:text-emerald-800 bg-emerald-50'
                          }`}
                        >
                          {usuario.activo !== false ? (
                            <><PowerOff size={14} /> Desactivar</>
                          ) : (
                            <><Power size={14} /> Activar</>
                          )}
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

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-violet-50">
              <h3 className="font-bold text-lg text-violet-800 flex items-center gap-2">
                {editingUserId ? <><Pencil size={20} /> Editar Usuario</> : <><Plus size={20} /> Nuevo Usuario</>}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                  placeholder="Ej: Juan Pérez"
                  value={form.nombre}
                  onChange={e => setForm({ ...form, nombre: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico {editingUserId ? '' : '*'}</label>
                <input
                  type="email"
                  required={!editingUserId}
                  disabled={!!editingUserId}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all disabled:opacity-60"
                  placeholder="ejemplo@correo.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                />
                {editingUserId && <p className="text-xs text-slate-400 mt-1">El correo no se puede modificar.</p>}
              </div>

              {!editingUserId && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña Temporal *</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                    placeholder="Contraseña segura"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rol de Usuario *</label>
                <select
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                  value={form.rol}
                  onChange={e => setForm({ ...form, rol: e.target.value as UserRole })}
                >
                  <option value="Vendedor">Vendedor</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Repartidor">Repartidor</option>
                  <option value="Almacen">Almacén</option>
                  <option value="Administrador">Administrador</option>
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving ? (
                    <><Loader2 size={16} className="animate-spin" /> Guardando...</>
                  ) : (
                    editingUserId ? 'Guardar Cambios' : 'Crear Usuario'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
