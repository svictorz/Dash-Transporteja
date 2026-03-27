import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * POST /api/admin/sync-photos
 * Body: { route_id, freight_id, driver_id }
 *
 * Checks Supabase Storage for photos in transport-photos/{route_id}/
 * and creates missing check-in records in the checkins table.
 */
export async function POST(request: NextRequest) {
  try {
    const { route_id, freight_id, driver_id } = await request.json()

    if (!route_id || !freight_id || !driver_id) {
      return NextResponse.json({ error: 'route_id, freight_id e driver_id são obrigatórios' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    const { data: files, error: storageErr } = await supabase.storage
      .from('transport-photos')
      .list(route_id, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })

    if (storageErr || !files || files.length === 0) {
      return NextResponse.json({ ok: true, synced: 0, message: 'Nenhuma foto encontrada no storage' })
    }

    const { data: existingCheckins } = await supabase
      .from('checkins')
      .select('photo_url')
      .eq('route_id', route_id)

    const existingUrls = new Set(
      (existingCheckins || []).map((c: any) => c.photo_url)
    )

    let synced = 0
    const errors: { file: string; error: string }[] = []

    for (const file of files) {
      if (!file.name || file.name.startsWith('.')) continue

      const { data: urlData } = supabase.storage
        .from('transport-photos')
        .getPublicUrl(`${route_id}/${file.name}`)

      const publicUrl = urlData?.publicUrl
      if (!publicUrl) continue

      if (existingUrls.has(publicUrl)) continue

      const type = file.name.startsWith('delivery') ? 'delivery' : 'pickup'

      const timestamp = file.created_at || new Date().toISOString()

      const { error: insertErr } = await supabase
        .from('checkins')
        .insert({
          type,
          photo_url: publicUrl,
          coords_lat: -22.8584,
          coords_lng: -47.2187,
          freight_id: freight_id,
          driver_id: driver_id,
          route_id: route_id,
          timestamp
        })

      if (insertErr) {
        errors.push({ file: file.name, error: insertErr.message })
      } else {
        synced++
        existingUrls.add(publicUrl)
      }
    }

    return NextResponse.json({ ok: true, synced, total_in_storage: files.length, errors })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
