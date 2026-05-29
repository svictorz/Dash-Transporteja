import { supabase } from '@/lib/supabase/client'

/** Quando não há motorista: placeholders aceitos pelo banco para veículo/placa */
export const ROUTE_NO_DRIVER_VEHICLE = 'A definir'
export const ROUTE_NO_DRIVER_PLATE = 'ABC1D23'

export interface Route {
  id: string
  freight_id: number
  driver_id: string | null
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
  driver_name?: string | null
  driver_phone?: string | null
  distance_km?: number | null
  freight_value?: number | null
  driver_value?: number | null
  taxes_value?: number | null
  /** 0, 10, 12 ou 18 — percentual sobre o valor do frete para tributos. */
  taxes_percent?: number | null
  net_freight_value?: number | null
  commission_value?: number | null
  /** Indica se a comissão do comercial já foi paga (alterável só por admin). */
  commission_paid?: boolean
  payment_status?: string | null
  payment_type?: string | null
  driver_payment_status?: string | null
  driver_payment_type?: string | null
  nf_value?: number | null
  /** Valor de CTE (Conhecimento de Transporte Eletrônico), manual. */
  cte_value?: number | null
  /** Valor de vale pedágio informado manualmente no cadastro do frete. */
  vale_pedagio?: number | null
  observation?: string | null
  created_by_user_id?: string | null
  created_at?: string
  updated_at?: string
}

export interface CreateRouteData {
  freight_id?: number
  driver_id?: string | null
  origin: string
  origin_state: string
  origin_address?: string
  destination: string
  destination_state: string
  destination_address?: string
  vehicle?: string
  plate?: string
  weight: string
  /** ISO yyyy-mm-dd ou vazio se ainda não definido */
  estimated_delivery?: string
  pickup_date?: string
  status?: 'pending' | 'inTransit' | 'pickedUp' | 'delivered' | 'cancelled'
  company_name?: string
  company_responsible?: string
  company_phone?: string
  company_email?: string
  company_address?: string
  company_city?: string
  company_state?: string
  driver_name?: string | null
  driver_phone?: string | null
  distance_km?: number | null
  freight_value?: number | null
  driver_value?: number | null
  taxes_value?: number | null
  taxes_percent?: number | null
  net_freight_value?: number | null
  commission_value?: number | null
  /** Indica se a comissão do comercial já foi paga (alterável só por admin). */
  commission_paid?: boolean
  payment_status?: string | null
  payment_type?: string | null
  driver_payment_status?: string | null
  driver_payment_type?: string | null
  nf_value?: number | null
  cte_value?: number | null
  vale_pedagio?: number | null
  observation?: string | null
  created_by_user_id?: string
}

export interface UpdateRouteData {
  freight_id?: number
  driver_id?: string | null
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
  driver_name?: string | null
  driver_phone?: string | null
  distance_km?: number | null
  freight_value?: number | null
  driver_value?: number | null
  taxes_value?: number | null
  taxes_percent?: number | null
  net_freight_value?: number | null
  commission_value?: number | null
  /** Indica se a comissão do comercial já foi paga (alterável só por admin). */
  commission_paid?: boolean
  payment_status?: string | null
  payment_type?: string | null
  driver_payment_status?: string | null
  driver_payment_type?: string | null
  nf_value?: number | null
  cte_value?: number | null
  vale_pedagio?: number | null
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
 *
 * Importante: `freight_id` é gerado pelo banco (sequence) quando não vier
 * explicitamente. Por isso, removemos o campo do payload se vier null/0.
 */
export async function createRoute(routeData: CreateRouteData): Promise<Route> {
  const pickup_date = routeData.pickup_date ?? ''
  const estimated_delivery = routeData.estimated_delivery ?? ''

  const hasDriver = Boolean(routeData.driver_id)
  const driver_id = hasDriver ? routeData.driver_id! : null
  const vehicle = routeData.vehicle ?? ROUTE_NO_DRIVER_VEHICLE
  const plate = routeData.plate ?? ROUTE_NO_DRIVER_PLATE

  const {
    pickup_date: _pd,
    estimated_delivery: _ed,
    driver_id: _ignoreDriver,
    vehicle: _ignoreVeh,
    plate: _ignorePlate,
    status: _st,
    freight_id: _fid,
    ...rest
  } = routeData

  const insertPayload: Record<string, unknown> = {
    ...rest,
    driver_id,
    vehicle,
    plate,
    pickup_date,
    estimated_delivery,
    status: routeData.status || 'pending',
  }

  // Só passa freight_id se vier um valor explícito (>0); caso contrário,
  // o banco usa o DEFAULT nextval(routes_freight_id_seq).
  if (routeData.freight_id != null && routeData.freight_id > 0) {
    insertPayload.freight_id = routeData.freight_id
  }

  const { data, error } = await supabase
    .from('routes')
    .insert(insertPayload)
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

