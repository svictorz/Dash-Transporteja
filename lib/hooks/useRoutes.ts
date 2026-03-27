import { useState, useEffect, useCallback, useRef } from 'react'
import { Route, getRoutes, createRoute, updateRoute, deleteRoute, CreateRouteData, UpdateRouteData } from '@/lib/services/routes'
import { supabase } from '@/lib/supabase/client'

export function useRoutes() {
  const [routes, setRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasLoadedRef = useRef(false)
  const isLoadingRef = useRef(false)

  // Carregar rotas
  const loadRoutes = useCallback(async () => {
    // Evitar múltiplas chamadas simultâneas
    if (isLoadingRef.current) return
    
    isLoadingRef.current = true
    try {
      setLoading(true)
      setError(null)
      const data = await getRoutes()
      setRoutes(data)
      hasLoadedRef.current = true
    } catch (err: any) {
      setError(err.message)
      console.error('Erro ao carregar rotas:', err)
    } finally {
      setLoading(false)
      isLoadingRef.current = false
    }
  }, [])

  // Carregar na montagem apenas uma vez
  useEffect(() => {
    if (!hasLoadedRef.current && !isLoadingRef.current) {
      loadRoutes()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Realtime: manter lista de rotas atualizada quando outro cliente ou o app alterar a tabela
  useEffect(() => {
    const channel = supabase
      .channel('routes-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'routes' },
        () => {
          loadRoutes()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadRoutes])

  // Criar rota
  const handleCreate = useCallback(async (routeData: CreateRouteData) => {
    try {
      setError(null)
      const newRoute = await createRoute(routeData)
      setRoutes(prev => [newRoute, ...prev])
      return newRoute
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }, [])

  // Atualizar rota
  const handleUpdate = useCallback(async (id: string, routeData: UpdateRouteData) => {
    try {
      setError(null)
      const updatedRoute = await updateRoute(id, routeData)
      setRoutes(prev => prev.map(r => r.id === id ? updatedRoute : r))
      return updatedRoute
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }, [])

  // Deletar rota
  const handleDelete = useCallback(async (id: string) => {
    try {
      setError(null)
      await deleteRoute(id)
      setRoutes(prev => prev.filter(r => r.id !== id))
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }, [])

  return {
    routes,
    loading,
    error,
    loadRoutes,
    createRoute: handleCreate,
    updateRoute: handleUpdate,
    deleteRoute: handleDelete
  }
}

