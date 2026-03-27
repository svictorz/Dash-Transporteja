import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Dev only' }, { status: 404 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, serviceKey)

  const { data, error } = await supabase
    .from('checkins')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    total: (data || []).length,
    checkins: (data || []).map(c => ({
      id: c.id,
      type: c.type,
      freight_id: c.freight_id,
      route_id: c.route_id,
      driver_id: c.driver_id,
      photo_url: c.photo_url ? `${c.photo_url.substring(0, 80)}...` : null,
      timestamp: c.timestamp,
      created_at: c.created_at,
      address: c.address,
    }))
  })
}
