import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type UserRole = 'Vendedor' | 'Supervisor' | 'Repartidor' | 'Almacen' | 'Administrador'
export type OrderStatus = 'Pendiente' | 'Listo para Despacho' | 'Asignado' | 'En ruta' | 'Entregado' | 'Incidencia' | 'Cancelado'

export interface Usuario {
  id: string
  nombre: string
  rol: UserRole
  email: string
  activo: boolean
}

export interface Pedido {
  id: string
  fecha: string
  id_cliente: string
  id_vendedor?: string
  id_repartidor?: string
  estado: string
  monto_total: number
  fecha_preparacion?: string
}

export interface Cliente {
  id: string
  nombre: string
  direccion: string
  telefono: string | null
  referencia: string | null
}

export interface Producto {
  id: string
  nombre: string
  precio_unitario: number
  stock: number
  estado: boolean
  imagen_url?: string | null
}

export interface PedidoProducto {
  id: string
  id_pedido: string
  id_producto: string | number
  cantidad: number
  precio_unitario: number
}

export interface Incidencia {
  id: string
  id_pedido: string
  motivo: string
  ruta_foto: string | null
  fecha_registro: string
}
