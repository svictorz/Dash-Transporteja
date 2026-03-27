import { supabase } from '@/lib/supabase/client'

export interface Client {
  id: string
  company_name: string
  cnpj?: string | null
  responsible: string
  whatsapp: string
  email: string
  address: string
  extension?: string | null
  city: string
  neighborhood: string
  state: string
  created_at?: string
  updated_at?: string
}

export interface CreateClientData {
  company_name: string
  cnpj?: string
  responsible: string
  whatsapp: string
  email: string
  address: string
  extension?: string
  city: string
  neighborhood: string
  state: string
}

export interface UpdateClientData {
  company_name?: string
  cnpj?: string | null
  responsible?: string
  whatsapp?: string
  email?: string
  address?: string
  extension?: string | null
  city?: string
  neighborhood?: string
  state?: string
}

/**
 * Buscar todos os clientes
 */
export async function getClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Erro ao buscar clientes: ${error.message}`)
  }

  return data || []
}

/**
 * Buscar cliente por ID
 */
export async function getClientById(id: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Erro ao buscar cliente: ${error.message}`)
  }

  return data
}

/**
 * Criar novo cliente
 */
export async function createClient(clientData: CreateClientData): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .insert(clientData)
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao criar cliente: ${error.message}`)
  }

  return data
}

/**
 * Atualizar cliente
 */
export async function updateClient(id: string, clientData: UpdateClientData): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .update(clientData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao atualizar cliente: ${error.message}`)
  }

  return data
}

/**
 * Deletar cliente
 */
export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(`Erro ao deletar cliente: ${error.message}`)
  }
}

