import { supabase } from '@/lib/supabase/client'

export interface Driver {
  id: string
  user_id?: string | null
  name: string
  phone: string
  email: string
  cnh: string
  vehicle: string
  plate: string
  status: 'active' | 'inactive' | 'onRoute'
  location?: string | null
  last_checkin?: string | null
  created_at?: string
  updated_at?: string
}

export interface CreateDriverData {
  name: string
  phone: string
  email: string
  cnh: string
  vehicle: string
  plate: string
  status?: 'active' | 'inactive' | 'onRoute'
  location?: string
  user_id?: string
}

export interface UpdateDriverData {
  name?: string
  phone?: string
  email?: string
  cnh?: string
  vehicle?: string
  plate?: string
  status?: 'active' | 'inactive' | 'onRoute'
  location?: string | null
}

/**
 * Buscar todos os motoristas
 */
export async function getDrivers(): Promise<Driver[]> {
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Erro ao buscar motoristas: ${error.message}`)
  }

  return data || []
}

/**
 * Buscar motorista por ID
 */
export async function getDriverById(id: string): Promise<Driver | null> {
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Não encontrado
    }
    throw new Error(`Erro ao buscar motorista: ${error.message}`)
  }

  return data
}

/**
 * Criar novo motorista
 */
export async function createDriver(driverData: CreateDriverData): Promise<Driver> {
  const { data, error } = await supabase
    .from('drivers')
    .insert({
      ...driverData,
      status: driverData.status || 'active'
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao criar motorista: ${error.message}`)
  }

  return data
}

/**
 * Atualizar motorista
 */
export async function updateDriver(id: string, driverData: UpdateDriverData): Promise<Driver> {
  const { data, error } = await supabase
    .from('drivers')
    .update(driverData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao atualizar motorista: ${error.message}`)
  }

  return data
}

/**
 * Deletar motorista
 */
export async function deleteDriver(id: string): Promise<void> {
  const { error } = await supabase
    .from('drivers')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(`Erro ao deletar motorista: ${error.message}`)
  }
}

/**
 * Buscar motoristas com filtros
 */
export async function searchDrivers(query: string): Promise<Driver[]> {
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .or(`name.ilike.%${query}%,phone.ilike.%${query}%,plate.ilike.%${query}%,vehicle.ilike.%${query}%,email.ilike.%${query}%`)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Erro ao buscar motoristas: ${error.message}`)
  }

  return data || []
}

/**
 * Buscar motoristas por status
 */
export async function getDriversByStatus(status: 'active' | 'inactive' | 'onRoute'): Promise<Driver[]> {
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Erro ao buscar motoristas: ${error.message}`)
  }

  return data || []
}

