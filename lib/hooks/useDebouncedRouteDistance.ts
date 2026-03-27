'use client'

import { useState, useEffect, useRef } from 'react'

export interface DebouncedRouteDistanceResult {
  distanciaKm: number | null
  duracaoMin: number | null
  origemResolvida: string | null
  destinoResolvida: string | null
  loading: boolean
  error: string | null
}

/**
 * Calcula distância/tempo via /api/rotas/distancia com debounce (estilo mapas).
 */
export function useDebouncedRouteDistance(
  origemQuery: string,
  destinoQuery: string,
  active: boolean,
  debounceMs = 1000
): DebouncedRouteDistanceResult {
  const [state, setState] = useState<DebouncedRouteDistanceResult>({
    distanciaKm: null,
    duracaoMin: null,
    origemResolvida: null,
    destinoResolvida: null,
    loading: false,
    error: null,
  })
  const seq = useRef(0)

  useEffect(() => {
    if (!active || !origemQuery.trim() || !destinoQuery.trim()) {
      setState({
        distanciaKm: null,
        duracaoMin: null,
        origemResolvida: null,
        destinoResolvida: null,
        loading: false,
        error: null,
      })
      return
    }

    if (origemQuery.trim().length < 4 || destinoQuery.trim().length < 4) {
      setState({
        distanciaKm: null,
        duracaoMin: null,
        origemResolvida: null,
        destinoResolvida: null,
        loading: false,
        error: null,
      })
      return
    }

    const id = ++seq.current
    const t = window.setTimeout(async () => {
      setState((s) => ({
        ...s,
        loading: true,
        error: null,
      }))
      try {
        const url = `/api/rotas/distancia?origem=${encodeURIComponent(origemQuery.trim())}&destino=${encodeURIComponent(destinoQuery.trim())}`
        const res = await fetch(url)
        const data = (await res.json()) as {
          error?: string
          distanciaKm?: number
          duracaoMin?: number
          origemResolvida?: string
          destinoResolvida?: string
        }
        if (seq.current !== id) return
        if (!res.ok) {
          setState({
            distanciaKm: null,
            duracaoMin: null,
            origemResolvida: null,
            destinoResolvida: null,
            loading: false,
            error: data.error || 'Não foi possível calcular a distância.',
          })
          return
        }
        setState({
          distanciaKm: data.distanciaKm ?? null,
          duracaoMin: data.duracaoMin ?? null,
          origemResolvida: data.origemResolvida ?? null,
          destinoResolvida: data.destinoResolvida ?? null,
          loading: false,
          error: null,
        })
      } catch {
        if (seq.current !== id) return
        setState({
          distanciaKm: null,
          duracaoMin: null,
          origemResolvida: null,
          destinoResolvida: null,
          loading: false,
          error: 'Erro de rede.',
        })
      }
    }, debounceMs)

    return () => window.clearTimeout(t)
  }, [origemQuery, destinoQuery, active, debounceMs])

  return state
}
