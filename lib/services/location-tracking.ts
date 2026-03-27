import { supabase } from '@/lib/supabase/client'

export interface LocationUpdate {
  id?: string
  route_id: string
  driver_id?: string
  freight_id: number
  coords_lat: number
  coords_lng: number
  accuracy?: number
  speed?: number
  heading?: number
  timestamp?: string
}

export interface RouteTrack {
  coords_lat: number
  coords_lng: number
  accuracy?: number
  speed?: number
  heading?: number
  timestamp: string
}

/**
 * Salvar atualização de localização
 */
export async function saveLocationUpdate(data: LocationUpdate): Promise<LocationUpdate> {
  const { data: result, error } = await supabase
    .from('location_updates')
    .insert({
      route_id: data.route_id,
      driver_id: data.driver_id,
      freight_id: data.freight_id,
      coords_lat: data.coords_lat,
      coords_lng: data.coords_lng,
      accuracy: data.accuracy,
      speed: data.speed,
      heading: data.heading
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao salvar localização: ${error.message}`)
  }

  return result
}

/**
 * Buscar trajeto completo de uma rota (via RPC, compatível com RLS restrito)
 */
export async function getRouteTrack(freightId: number): Promise<RouteTrack[]> {
  const { data, error } = await supabase
    .rpc('get_route_track', { p_freight_id: freightId })

  if (error) {
    throw new Error(`Erro ao buscar trajeto: ${error.message}`)
  }

  return Array.isArray(data) ? data : []
}

/**
 * Buscar última localização de uma rota (via RPC, compatível com RLS restrito)
 */
export async function getLastRouteLocation(freightId: number): Promise<RouteTrack | null> {
  const { data, error } = await supabase
    .rpc('get_last_route_location', { p_freight_id: freightId })

  if (error) {
    throw new Error(`Erro ao buscar última localização: ${error.message}`)
  }

  const row = Array.isArray(data) ? data[0] : data
  return row ?? null
}

/**
 * Deletar localizações antigas de uma rota (limpeza)
 */
export async function deleteOldLocations(routeId: string, daysToKeep: number = 7): Promise<void> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

  const { error } = await supabase
    .from('location_updates')
    .delete()
    .eq('route_id', routeId)
    .lt('timestamp', cutoffDate.toISOString())

  if (error) {
    throw new Error(`Erro ao deletar localizações antigas: ${error.message}`)
  }
}

