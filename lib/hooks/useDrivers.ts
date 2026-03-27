import { useState, useEffect, useCallback, useRef } from 'react'
import { Driver, getDrivers, createDriver, updateDriver, deleteDriver, CreateDriverData, UpdateDriverData } from '@/lib/services/drivers'
import { supabase } from '@/lib/supabase/client'

export function useDrivers() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasLoadedRef = useRef(false)
  const isLoadingRef = useRef(false)

  // Carregar motoristas
  const loadDrivers = useCallback(async () => {
    // Evitar múltiplas chamadas simultâneas
    if (isLoadingRef.current) return
    
    isLoadingRef.current = true
    try {
      setLoading(true)
      setError(null)
      const data = await getDrivers()
      setDrivers(data)
      hasLoadedRef.current = true
    } catch (err: any) {
      setError(err.message)
      console.error('Erro ao carregar motoristas:', err)
    } finally {
      setLoading(false)
      isLoadingRef.current = false
    }
  }, [])

  // Carregar na montagem apenas uma vez
  useEffect(() => {
    if (!hasLoadedRef.current && !isLoadingRef.current) {
      loadDrivers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Realtime: manter lista de motoristas atualizada
  useEffect(() => {
    const channel = supabase
      .channel('drivers-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drivers' },
        () => loadDrivers()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadDrivers])

  // Criar motorista
  const handleCreate = useCallback(async (driverData: CreateDriverData) => {
    try {
      setError(null)
      const newDriver = await createDriver(driverData)
      setDrivers(prev => [newDriver, ...prev])
      return newDriver
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }, [])

  // Atualizar motorista
  const handleUpdate = useCallback(async (id: string, driverData: UpdateDriverData) => {
    try {
      setError(null)
      const updatedDriver = await updateDriver(id, driverData)
      setDrivers(prev => prev.map(d => d.id === id ? updatedDriver : d))
      return updatedDriver
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }, [])

  // Deletar motorista
  const handleDelete = useCallback(async (id: string) => {
    try {
      setError(null)
      await deleteDriver(id)
      setDrivers(prev => prev.filter(d => d.id !== id))
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }, [])

  return {
    drivers,
    loading,
    error,
    loadDrivers,
    createDriver: handleCreate,
    updateDriver: handleUpdate,
    deleteDriver: handleDelete
  }
}

