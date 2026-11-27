'use client'

import { useEffect, useRef, useState } from 'react'

type RouteStop = { label: string; lat: number; lon: number; kind: 'origin' | 'destination' }
type RouteMapProps = { coordinates: [number, number][] | null; stops: RouteStop[] }

type LeafletApi = {
  map: (element: HTMLElement) => any
  tileLayer: (url: string, options: Record<string, unknown>) => any
  polyline: (coordinates: [number, number][], options: Record<string, unknown>) => any
  marker: (coordinate: [number, number], options: Record<string, unknown>) => any
  divIcon: (options: Record<string, unknown>) => any
}

function pinIcon(api: LeafletApi, kind: 'origin' | 'destination', number: number, multiple: boolean) {
  const pin = document.createElement('div')
  pin.className = `jcn-route-pin jcn-route-pin--${kind}`
  const letter = document.createElement('span')
  letter.textContent = `${kind === 'origin' ? 'O' : 'D'}${multiple ? number : ''}`
  pin.appendChild(letter)
  return api.divIcon({ html: pin, className: 'jcn-route-pin-icon', iconSize: [34, 42], iconAnchor: [17, 39] })
}

let leafletPromise: Promise<LeafletApi> | null = null

function loadLeaflet(): Promise<LeafletApi> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Mapa indisponível no servidor'))
  const loaded = (window as typeof window & { L?: LeafletApi }).L
  if (loaded) return Promise.resolve(loaded)
  if (leafletPromise) return leafletPromise
  leafletPromise = new Promise<LeafletApi>((resolve, reject) => {
    const stylesheet = document.createElement('link')
    stylesheet.rel = 'stylesheet'
    stylesheet.href = '/vendor/leaflet/leaflet.css'
    document.head.appendChild(stylesheet)
    const script = document.createElement('script')
    script.src = '/vendor/leaflet/leaflet.js'
    script.onload = () => {
      const api = (window as typeof window & { L?: LeafletApi }).L
      if (api) resolve(api)
      else reject(new Error('Biblioteca do mapa indisponível'))
    }
    script.onerror = () => reject(new Error('Não foi possível carregar o mapa'))
    document.head.appendChild(script)
  }).catch(error => {
    leafletPromise = null
    throw error
  })
  return leafletPromise
}

export default function RouteMap({ coordinates, stops }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const layersRef = useRef<any[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    loadLeaflet().then(api => {
      if (!active || !containerRef.current) return
      const map = api.map(containerRef.current).setView([-14.235, -51.9253], 4)
      api.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors', maxZoom: 18,
      }).addTo(map)
      mapRef.current = map
      setReady(true)
    }).catch(() => { if (active) setError(true) })
    return () => {
      active = false
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!ready || !mapRef.current) return
    layersRef.current.forEach(layer => layer.remove())
    layersRef.current = []
    if (!coordinates || coordinates.length < 2) return
    const api = (window as typeof window & { L?: LeafletApi }).L
    if (!api) return
    const line = api.polyline(coordinates, { color: '#2878ef', weight: 5 }).addTo(mapRef.current)
    const originCount = stops.filter(stop => stop.kind === 'origin').length
    const destinationCount = stops.length - originCount
    let originNumber = 0
    let destinationNumber = 0
    const markers = stops.map((stop, index) => {
      const number = stop.kind === 'origin' ? ++originNumber : ++destinationNumber
      const multiple = stop.kind === 'origin' ? originCount > 1 : destinationCount > 1
      const marker = api.marker([stop.lat, stop.lon], { icon: pinIcon(api, stop.kind, number, multiple) }).addTo(mapRef.current)
      const label = document.createElement('span')
      label.textContent = `${stop.kind === 'origin' ? 'Origem' : 'Destino'} ${number}: ${stop.label}`
      const permanent = index === 0 || index === stops.length - 1
      marker.bindTooltip(label, { permanent, direction: index === 0 ? 'top' : 'bottom', offset: index === 0 ? [0, -35] : [0, 5], className: `jcn-route-tooltip jcn-route-tooltip--${stop.kind}` })
      if (permanent) marker.openTooltip()
      return marker
    })
    layersRef.current = [line, ...markers]
    mapRef.current.fitBounds(line.getBounds(), { padding: [70, 70] })
  }, [coordinates, stops, ready])

  return <div className="relative overflow-hidden rounded-lg border border-[#c7d7ea] bg-[#eaf2f8]">
    <div ref={containerRef} className="h-[310px] w-full max-sm:h-[250px]" aria-label="Mapa da rota" />
    {error && <p className="absolute inset-0 grid place-items-center bg-[#eaf2f8] p-4 text-center text-sm text-slate-600">Mapa indisponível. O cálculo de distância continua disponível.</p>}
  </div>
}
