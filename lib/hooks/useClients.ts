import { useState, useEffect, useCallback, useRef } from 'react'
import { Client, getClients, createClient, updateClient, deleteClient, CreateClientData, UpdateClientData } from '@/lib/services/clients'
import { supabase } from '@/lib/supabase/client'

export function useClients() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasLoadedRef = useRef(false)
  const isLoadingRef = useRef(false)

  const loadClients = useCallback(async () => {
    // Evitar múltiplas chamadas simultâneas
    if (isLoadingRef.current) return
    
    isLoadingRef.current = true
    try {
      setLoading(true)
      setError(null)
      const data = await getClients()
      setClients(data)
      hasLoadedRef.current = true
    } catch (err: any) {
      setError(err.message)
      console.error('Erro ao carregar clientes:', err)
    } finally {
      setLoading(false)
      isLoadingRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!hasLoadedRef.current && !isLoadingRef.current) {
      loadClients()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Realtime: manter lista de clientes atualizada
  useEffect(() => {
    const channel = supabase
      .channel('clients-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clients' },
        () => loadClients()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadClients])

  const handleCreate = useCallback(async (clientData: CreateClientData) => {
    try {
      setError(null)
      const newClient = await createClient(clientData)
      setClients(prev => [newClient, ...prev])
      return newClient
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }, [])

  const handleUpdate = useCallback(async (id: string, clientData: UpdateClientData) => {
    try {
      setError(null)
      const updatedClient = await updateClient(id, clientData)
      setClients(prev => prev.map(c => c.id === id ? updatedClient : c))
      return updatedClient
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    try {
      setError(null)
      await deleteClient(id)
      setClients(prev => prev.filter(c => c.id !== id))
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }, [])

  return {
    clients,
    loading,
    error,
    loadClients,
    createClient: handleCreate,
    updateClient: handleUpdate,
    deleteClient: handleDelete
  }
}

