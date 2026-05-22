import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Pencil, Power, PowerOff, LogOut, X, Loader2, Package, Search, Users, UserCircle2, LayoutList, ImagePlus } from 'lucide-react';
import { supabase } from '../../services/supabase';
import type { Producto } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';

// Estado inicial del formulario
const emptyForm = {
  nombre: '',
  precio_unitario: '',
  stock: '',
  imagen_url: '',
};

export default function AdminDashboard() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);

  const { profile, loading, signOut } = useAuth();
  const navigate = useNavigate();

  // Guardia de rol
  useEffect(() => {
    if (!loading && (!profile || profile.rol !== 'Administrador')) {
      navigate('/login');
    }
  }, [profile, loading, navigate]);

  // Fetch inicial
  useEffect(() => {
    if (profile?.rol === 'Administrador') {
      fetchProductos();
    }
  }, [profile]);

  // ==================== CRUD ====================

  // READ
  const fetchProductos = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('producto')
      .select('*')
      .order('nombre', { ascending: true });

    if (error) {
      console.error('Error fetching productos:', error.message);
    }
    if (data) {
      setProductos(data);
    }
    setIsLoading(false);
  };

  const handleCreate = async () => {
    setIsSaving(true);
    try {
      let finalImageUrl = form.imagen_url.trim() || null;

      if (imagenFile) {
        const fileExt = imagenFile.name.split('.').pop() || 'jpg';
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('productos')
          .upload(fileName, imagenFile);
          
        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage.from('productos').getPublicUrl(fileName);
          finalImageUrl = publicUrlData.publicUrl;
        } else {
          console.error('Error subiendo imagen:', uploadError);
          alert('No se pudo subir la imagen, pero se guardará el producto.');
        }
      }

      const { data, error } = await supabase
        .from('producto')
        .insert([{
          nombre: form.nombre.trim(),
          precio_unitario: parseFloat(form.precio_unitario),
          stock: parseInt(form.stock),
          imagen_url: finalImageUrl,
          estado: true
        }])
        .select()
        .single();

      if (error) throw error;

      // Añadir al estado local sin recargar
      setProductos(prev => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      closeModal();
      alert('¡Producto creado exitosamente!');
    } catch (error: any) {
      console.error('Error al crear producto:', error.message);
      alert(`Error al crear producto: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingProductId) return;
    setIsSaving(true);

    try {
      let finalImageUrl = form.imagen_url.trim() || null;

      if (imagenFile) {
        const fileExt = imagenFile.name.split('.').pop() || 'jpg';
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('productos')
          .upload(fileName, imagenFile);
          
        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage.from('productos').getPublicUrl(fileName);
          finalImageUrl = publicUrlData.publicUrl;
        } else {
          console.error('Error subiendo imagen:', uploadError);
          alert('No se pudo subir la nueva imagen, conservando la anterior.');
        }
      }

      const { data, error } = await supabase
        .from('producto')
        .update({
          nombre: form.nombre.trim(),
          precio_unitario: parseFloat(form.precio_unitario),
          stock: parseInt(form.stock),
          imagen_url: finalImageUrl,
        })
        .eq('id', editingProductId)
        .select()
        .single();

      if (error) throw error;

      // Actualizar en el estado local
      setProductos(prev =>
        prev.map(p => p.id === editingProductId ? data : p)
          .sort((a, b) => a.nombre.localeCompare(b.nombre))
      );
      closeModal();
      alert('¡Producto actualizado!');
    } catch (error: any) {
      console.error('Error al actualizar producto:', error.message);
      alert(`Error al actualizar: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // SOFT DELETE (toggle estado)
  const handleToggleEstado = async (producto: Producto) => {
    const nuevoEstado = !producto.estado;
    const { error } = await supabase
      .from('producto')
      .update({ estado: nuevoEstado })
      .eq('id', producto.id);

    if (error) {
      console.error('Error al cambiar estado:', error.message);
      alert(`Error: ${error.message}`);
      return;
    }

    // Actualizar local
    setProductos(prev =>
      prev.map(p => p.id === producto.id ? { ...p, estado: nuevoEstado } : p)
    );
  };

  // ==================== MODAL HELPERS ====================

  const openCreateModal = () => {
    setEditingProductId(null);
    setForm(emptyForm);
    setImagenFile(null);
    setImagenPreview(null);
    setIsModalOpen(true);
  };

  const openEditModal = (producto: Producto) => {
    setEditingProductId(producto.id);
    setForm({
      nombre: producto.nombre,
      precio_unitario: producto.precio_unitario.toString(),
      stock: producto.stock.toString(),
      imagen_url: producto.imagen_url || '',
    });
    setImagenFile(null);
    setImagenPreview(producto.imagen_url || null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProductId(null);
    setForm(emptyForm);
    setImagenFile(null);
    setImagenPreview(null);
  };

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImagenFile(file);
      setImagenPreview(URL.createObjectURL(file));
      setForm({ ...form, imagen_url: '' }); // Limpiar URL si sube archivo
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim() || !form.precio_unitario || !form.stock) {
      alert('Todos los campos son obligatorios.');
      return;
    }
    if (editingProductId) {
      handleUpdate();
    } else {
      handleCreate();
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  // ==================== RENDER GUARDS ====================

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-slate-500">Cargando panel...</p></div>;
  if (!profile || profile.rol !== 'Administrador') return null;

  // Filtro de búsqueda
  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: productos.length,
    activos: productos.filter(p => p.estado).length,
    inactivos: productos.filter(p => !p.estado).length,
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      {/* Header */}
      <header className="mb-6 md:mb-8 flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Panel de Administrador</h1>
          <p className="text-slate-500 text-sm md:text-base">Gestión de Catálogo de Productos</p>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          <nav className="hidden sm:flex gap-1 mr-2">
            <Link to="/admin" className="px-3 py-2 text-sm font-medium text-violet-700 bg-violet-100 rounded-xl transition-colors flex items-center gap-1.5"><Package size={16} /> Productos</Link>
            <Link to="/admin/usuarios" className="px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1.5"><Users size={16} /> Personal</Link>
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

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 md:mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
          <div className="p-3 bg-violet-100 text-violet-600 rounded-xl"><Package size={24} /></div>
          <div><p className="text-sm text-slate-500">Total Productos</p><p className="text-2xl font-bold">{stats.total}</p></div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><Power size={24} /></div>
          <div><p className="text-sm text-slate-500">Activos</p><p className="text-2xl font-bold text-emerald-600">{stats.activos}</p></div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
          <div className="p-3 bg-slate-100 text-slate-500 rounded-xl"><PowerOff size={24} /></div>
          <div><p className="text-sm text-slate-500">Inactivos</p><p className="text-2xl font-bold text-slate-500">{stats.inactivos}</p></div>
        </div>
      </div>

      {/* Barra de acciones */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 md:p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-800">Catálogo de Productos</h2>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {/* Buscador */}
            <div className="relative flex-1 sm:flex-initial">
              <input
                type="text"
                placeholder="Buscar producto..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full sm:w-64 pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all text-sm"
              />
              <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            </div>
            {/* Botón Nuevo */}
            <button
              onClick={openCreateModal}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors shadow-sm active:scale-[0.98] text-sm"
            >
              <Plus size={18} /> Nuevo Producto
            </button>
          </div>
        </div>

        {/* Tabla */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={32} className="animate-spin mr-2" />
            <p>Cargando productos...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm">
                  <th className="p-4 font-medium">Producto</th>
                  <th className="p-4 font-medium">Precio Unit.</th>
                  <th className="p-4 font-medium">Stock</th>
                  <th className="p-4 font-medium">Estado</th>
                  <th className="p-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      {searchTerm ? 'No se encontraron productos con ese nombre.' : 'No hay productos registrados.'}
                    </td>
                  </tr>
                ) : productosFiltrados.map(producto => (
                  <tr key={producto.id} className={`hover:bg-slate-50/50 transition-colors ${!producto.estado ? 'opacity-50' : ''}`}>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img 
                          src={producto.imagen_url || 'https://placehold.co/100x100/f8fafc/64748b?text=Sin+Foto'} 
                          alt={producto.nombre}
                          className="w-10 h-10 rounded-lg object-cover border border-slate-200"
                        />
                        <div>
                          <p className="font-medium text-slate-700">{producto.nombre}</p>
                          <p className="text-xs text-slate-400 font-mono">#{producto.id.substring(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-slate-600 font-semibold">S/ {producto.precio_unitario.toFixed(2)}</td>
                    <td className="p-4">
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-sm font-bold ${
                        producto.stock <= 0 ? 'bg-red-100 text-red-700' :
                        producto.stock <= 10 ? 'bg-amber-100 text-amber-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {producto.stock} uds
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        producto.estado ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {producto.estado ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(producto)}
                          className="text-violet-600 hover:text-violet-800 font-medium text-sm bg-violet-50 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1"
                        >
                          <Pencil size={14} /> Editar
                        </button>
                        <button
                          onClick={() => handleToggleEstado(producto)}
                          className={`font-medium text-sm px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1 ${
                            producto.estado
                              ? 'text-red-600 hover:text-red-800 bg-red-50'
                              : 'text-emerald-600 hover:text-emerald-800 bg-emerald-50'
                          }`}
                        >
                          {producto.estado ? (
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

      {/* Modal: Crear / Editar Producto */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-violet-50">
              <h3 className="font-bold text-lg text-violet-800 flex items-center gap-2">
                {editingProductId ? <><Pencil size={20} /> Editar Producto</> : <><Plus size={20} /> Nuevo Producto</>}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Producto *</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                  placeholder="Ej: Manzana Roja Premium"
                  value={form.nombre}
                  onChange={e => setForm({ ...form, nombre: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Precio Unitario (S/) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                    placeholder="0.00"
                    value={form.precio_unitario}
                    onChange={e => setForm({ ...form, precio_unitario: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stock Disponible *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                    placeholder="0"
                    value={form.stock}
                    onChange={e => setForm({ ...form, stock: e.target.value })}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Imagen del Producto (Opcional)</label>
                
                {/* Opcion 1: Archivo local */}
                <div className="mb-3">
                  <label className="flex items-center justify-center w-full p-4 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors bg-white">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ImagePlus size={24} className="text-violet-500" />
                      <span className="text-sm font-medium text-slate-600">Subir foto desde tu PC</span>
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={handleFotoChange} />
                  </label>
                </div>

                {/* Opcion 2: URL */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="text-xs text-slate-400 font-medium uppercase">O pega un enlace</span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                <input
                  type="url"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all text-sm"
                  placeholder="https://..."
                  value={form.imagen_url}
                  onChange={e => {
                    setForm({ ...form, imagen_url: e.target.value });
                    if (e.target.value) {
                      setImagenFile(null);
                      setImagenPreview(e.target.value);
                    } else if (!imagenFile) {
                      setImagenPreview(null);
                    }
                  }}
                />

                {/* Preview */}
                {imagenPreview && (
                  <div className="mt-4 relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 aspect-video flex items-center justify-center">
                    <img src={imagenPreview} alt="Vista previa" className="max-h-full max-w-full object-contain" />
                    <button 
                      type="button"
                      onClick={() => { setImagenFile(null); setImagenPreview(null); setForm({...form, imagen_url: ''}) }}
                      className="absolute top-2 right-2 bg-white/80 hover:bg-white text-slate-800 p-1.5 rounded-full shadow-sm backdrop-blur-sm transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
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
                    editingProductId ? 'Guardar Cambios' : 'Crear Producto'
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
