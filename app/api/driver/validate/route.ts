import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function normalizePlate(plate: string): string {
  return plate.replace(/[\s\-\.]/g, '').toUpperCase().trim()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { plate, freight_code } = body

    if (!plate || !freight_code) {
      return NextResponse.json(
        { error: 'Placa e código do transporte são obrigatórios' },
        { status: 400 }
      )
    }

    const normalizedPlate = normalizePlate(plate)
    const freightId = typeof freight_code === 'string'
      ? parseInt(freight_code, 10)
      : freight_code

    if (isNaN(freightId)) {
      return NextResponse.json(
        { error: 'Código do transporte inválido' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: route, error: routeError } = await supabase
      .from('routes')
      .select('id, freight_id, driver_id, origin, origin_state, destination, destination_state, vehicle, plate, weight, estimated_delivery, pickup_date, status, company_name')
      .eq('freight_id', freightId)
      .limit(1)
      .single()

    if (routeError || !route) {
      return NextResponse.json(
        { error: 'Placa ou código inválidos' },
        { status: 401 }
      )
    }

    const routePlateNormalized = normalizePlate(route.plate)
    if (routePlateNormalized !== normalizedPlate) {
      return NextResponse.json(
        { error: 'Placa ou código inválidos' },
        { status: 401 }
      )
    }

    let driver = null
    if (route.driver_id) {
      const { data: driverData } = await supabase
        .from('drivers')
        .select('id, name, phone, email, cnh, vehicle, plate')
        .eq('id', route.driver_id)
        .single()
      driver = driverData
    }

    return NextResponse.json({
      success: true,
      route: {
        id: route.id,
        freight_id: route.freight_id,
        origin: route.origin,
        origin_state: route.origin_state,
        destination: route.destination,
        destination_state: route.destination_state,
        vehicle: route.vehicle,
        plate: route.plate,
        weight: route.weight,
        estimated_delivery: route.estimated_delivery,
        pickup_date: route.pickup_date,
        status: route.status,
        company_name: route.company_name,
      },
      driver,
    })
  } catch {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
