import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(request: NextRequest) {
  try {
    const { fixes } = await request.json() as {
      fixes: { id: string; correctFreightId: number | null; correctRouteId: string | null }[]
    }

    if (!Array.isArray(fixes) || fixes.length === 0) {
      return NextResponse.json({ ok: true, updated: 0 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    let updated = 0

    for (const fix of fixes) {
      const { error } = await supabase
        .from('checkins')
        .update({ freight_id: fix.correctFreightId, route_id: fix.correctRouteId })
        .eq('id', fix.id)

      if (!error) updated++
    }

    return NextResponse.json({ ok: true, updated })
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    )
  }
}
