import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Dev only' }, { status: 404 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, serviceKey)

  const buckets = ['transport-photos', 'checkin-photos']
  const results: any[] = []

  for (const bucket of buckets) {
    const { data: folders, error: foldersErr } = await supabase.storage
      .from(bucket)
      .list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })

    if (foldersErr) {
      results.push({ bucket, error: foldersErr.message })
      continue
    }

    for (const folder of (folders || [])) {
      if (folder.id) {
        results.push({ bucket, type: 'file', name: folder.name, created_at: folder.created_at })
        continue
      }
      const { data: files } = await supabase.storage
        .from(bucket)
        .list(folder.name, { limit: 50, sortBy: { column: 'created_at', order: 'desc' } })

      for (const file of (files || [])) {
        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(`${folder.name}/${file.name}`)
        results.push({
          bucket,
          folder: folder.name,
          file: file.name,
          created_at: file.created_at,
          url: urlData?.publicUrl || null
        })
      }
    }
  }

  return NextResponse.json({
    total: results.length,
    photos: results
  })
}
