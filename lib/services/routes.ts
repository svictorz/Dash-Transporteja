import { supabase } from '@/lib/supabase/client'
import { generateFreightCode } from '@/lib/utils/freight-code'

export interface Route {
  id: string
  freight_id: number
  driver_id: string
  origin: string
  origin_state: string
  origin_address?: string | null
  destination: string
  destination_state: string
  destination_address?: string | null
  vehicle: string
  plate: string
  weight: string
  estimated_delivery: string
  pickup_date: string
  status: 'pending' | 'inTransit' | 'pickedUp' | 'delivered' | 'cancelled'
  company_name?: string | null
  company_responsible?: string | null
  company_phone?: string | null
  company_email?: string | null
  company_address?: string | null
  company_city?: string | null
  company_state?: string | null
  distance_km?: number | null
  nf_value?: number | null
  observation?: string | null
  created_by_user_id?: string | null
  created_at?: string
  updated_at?: string
}

export interface CreateRouteData {
  freight_id?: number
  driver_id: string
  origin: string
  origin_state: string
  origin_address?: string
  destination: string
  destination_state: string
  destination_address?: string
  vehicle: string
  plate: string
  weight: string
  estimated_delivery: string
  pickup_date: string
  status?: 'pending' | 'inTransit' | 'pickedUp' | 'delivered' | 'cancelled'
  company_name?: string
  company_responsible?: string
  company_phone?: string
  company_email?: string
  company_address?: string
  company_city?: string
  company_state?: string
  distance_km?: number | null
  nf_value?: number | null
  observation?: string | null
  created_by_user_id?: string
}

export interface UpdateRouteData {
  freight_id?: number
  driver_id?: string
  origin?: string
  origin_state?: string
  origin_address?: string | null
  destination?: string
  destination_state?: string
  destination_address?: string | null
  vehicle?: string
  plate?: string
  weight?: string
  estimated_delivery?: string
  pickup_date?: string
  status?: 'pending' | 'inTransit' | 'pickedUp' | 'delivered' | 'cancelled'
  company_name?: string | null
  company_responsible?: string | null
  company_phone?: string | null
  company_email?: string | null
  company_address?: string | null
  company_city?: string | null
  company_state?: string | null
  distance_km?: number | null
  nf_value?: number | null
  observation?: string | null
}

/**
 * Buscar todas as rotas com dados do motorista
 */
export async function getRoutes(): Promise<Route[]> {
  const { data, error } = await supabase
    .from('routes')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Erro ao buscar rotas: ${error.message}`)
  }

  return data || []
}

/**
 * Buscar rota por ID
 */
export async function getRouteById(id: string): Promise<Route | null> {
  const { data, error } = await supabase
    .from('routes')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Erro ao buscar rota: ${error.message}`)
  }

  return data
}

/**
 * Buscar rota por freight_id
 */
export async function getRouteByFreightId(freightId: number): Promise<Route | null> {
  const { data, error } = await supabase
    .from('routes')
    .select('*')
    .eq('freight_id', freightId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Erro ao buscar rota: ${error.message}`)
  }

  return data
}

/**
 * Criar nova rota
 */
export async function createRoute(routeData: CreateRouteData): Promise<Route> {
  if (routeData.freight_id == null || routeData.freight_id === 0) {
    routeData.freight_id = generateFreightCode()
  }

  const { data, error } = await supabase
    .from('routes')
    .insert({
      ...routeData,
      status: routeData.status || 'pending'
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao criar rota: ${error.message}`)
  }

  return data
}

/**
 * Atualizar rota
 */
export async function updateRoute(id: string, routeData: UpdateRouteData): Promise<Route> {
  const { data, error } = await supabase
    .from('routes')
    .update(routeData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao atualizar rota: ${error.message}`)
  }

  return data
}

/**
 * Deletar rota
 */
export async function deleteRoute(id: string): Promise<void> {
  const { error } = await supabase
    .from('routes')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(`Erro ao deletar rota: ${error.message}`)
  }
}

/**
 * Buscar rotas por status
 */
export async function getRoutesByStatus(status: 'pending' | 'inTransit' | 'pickedUp' | 'delivered' | 'cancelled'): Promise<Route[]> {
  const { data, error } = await supabase
    .from('routes')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Erro ao buscar rotas: ${error.message}`)
  }

  return data || []
}

/**
 * Buscar rotas por motorista
 */
export async function getRoutesByDriver(driverId: string): Promise<Route[]> {
  const { data, error } = await supabase
    .from('routes')
    .select('*')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Erro ao buscar rotas: ${error.message}`)
  }

  return data || []
}

