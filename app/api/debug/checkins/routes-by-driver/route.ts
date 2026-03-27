import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Apenas desenvolvimento' }, { status: 404 })
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Supabase não configurado' }, { status: 500 })
  }
  const { searchParams } = new URL(request.url)
  const driverId = searchParams.get('driver_id')
  if (!driverId) {
    return NextResponse.json({ error: 'Passe driver_id na query' }, { status: 400 })
  }
  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data, error } = await supabase
    .from('routes')
    .select('id, freight_id, driver_id, origin, destination, status, created_at')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ routes: data || [] })
}
