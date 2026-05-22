import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Login from './pages/Login/Login'
import SupervisorDashboard from './pages/Dashboard/SupervisorDashboard'
import MobileDelivery from './pages/Delivery/MobileDelivery'
import VendedorDashboard from './pages/Dashboard/VendedorDashboard'
import AlmacenDashboard from './pages/Dashboard/AlmacenDashboard'
import AdminDashboard from './pages/Dashboard/AdminDashboard'
import GestionUsuarios from './pages/Dashboard/GestionUsuarios'
import MonitorGlobal from './pages/Admin/MonitorGlobal'
import ClientManagement from './pages/Admin/ClientManagement'

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />

          {/* Rutas por rol */}
          <Route path="/dashboard" element={<SupervisorDashboard />} />
          <Route path="/vendedor" element={<VendedorDashboard />} />
          <Route path="/almacen" element={<AlmacenDashboard />} />
          <Route path="/delivery" element={<MobileDelivery />} />

          {/* Módulo Administrador */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/usuarios" element={<GestionUsuarios />} />
          <Route path="/admin/monitor" element={<MonitorGlobal />} />
          <Route path="/admin/clientes" element={<ClientManagement />} />

          {/* Fallback 404 */}
          <Route path="*" element={
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
              <h1 className="text-2xl font-bold text-slate-400">404 - Ruta no encontrada</h1>
            </div>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
