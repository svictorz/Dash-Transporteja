import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Rota de diagnóstico: lista os últimos check-ins do Supabase (com e sem foto).
 * Use apenas em desenvolvimento para achar fotos que o motorista subiu.
 *
 * Acesse: GET /api/debug/checkins
 * Ou com filtro: GET /api/debug/checkins?freight_id=930682320
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Disponível apenas em desenvolvimento' }, { status: 404 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Variáveis do Supabase não configuradas' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const freightIdParam = searchParams.get('freight_id')

  const supabase = createClient(supabaseUrl, supabaseKey)

  let query = supabase
    .from('checkins')
    .select('id, type, freight_id, route_id, driver_id, photo_url, timestamp, address, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (freightIdParam) {
    const freightId = parseInt(freightIdParam, 10)
    if (!isNaN(freightId)) {
      query = query.eq('freight_id', freightId)
    }
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json(
      { error: 'Erro ao buscar check-ins', details: error.message },
      { status: 500 }
    )
  }

  const withPhoto = (data || []).filter((c) => c.photo_url && c.photo_url.length > 0)
  const withoutPhoto = (data || []).filter((c) => !c.photo_url || c.photo_url.length === 0)

  return NextResponse.json({
    total: (data || []).length,
    com_foto: withPhoto.length,
    sem_foto: withoutPhoto.length,
    filtro_freight_id: freightIdParam || null,
    checkins: (data || []).map((c) => ({
      id: c.id,
      type: c.type,
      freight_id: c.freight_id,
      route_id: c.route_id,
      driver_id: c.driver_id,
      photo_url: c.photo_url ? `${c.photo_url.substring(0, 60)}...` : null,
      photo_url_completa: c.photo_url || null,
      timestamp: c.timestamp,
      created_at: c.created_at,
      address: c.address || null,
    })),
  })
}
