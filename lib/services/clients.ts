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
  created_by_user_id?: string | null
  created_at?: string
  updated_at?: string
}

export interface CreateClientData {
  company_name: string
  cnpj?: string
  responsible?: string
  whatsapp?: string
  email?: string
  address?: string
  extension?: string
  city?: string
  neighborhood?: string
  state?: string
  created_by_user_id?: string
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
  const { data: { session } } = await supabase.auth.getSession()
  const created_by_user_id = session?.user?.id ?? null

  const { data, error } = await supabase
    .from('clients')
    .insert({ ...clientData, created_by_user_id })
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

/**
 * Garante que existe um registro em `clients` para uma empresa informada
 * no fluxo de criação/edição de rota.
 *
 * - Se a empresa já estiver cadastrada (match por nome ou e-mail), apenas
 *   completa campos vazios (telefone, e-mail, responsável) com o que veio
 *   da rota.
 * - Caso contrário, cria um cliente "leve" com os dados disponíveis.
 *
 * Falhas aqui não devem interromper o fluxo da rota — por isso a função
 * captura erros internamente.
 */
export interface EnsureClientFromRouteInput {
  ownerUserId: string
  companyName: string
  responsible?: string | null
  phone?: string | null
  email?: string | null
  city?: string | null
  state?: string | null
  address?: string | null
}

export async function ensureClientFromRoute(
  input: EnsureClientFromRouteInput,
): Promise<Client | null> {
  const ownerUserId = input.ownerUserId?.trim()
  const companyName = input.companyName?.trim()
  if (!ownerUserId) return null
  if (!companyName) return null

  try {
    const phone = input.phone?.trim() || null
    const email = input.email?.trim().toLowerCase() || null

    // 1) tenta achar match por nome (case-insensitive) ou e-mail
    let existing: Client | null = null
    {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('created_by_user_id', ownerUserId)
        .or(
          [
            `company_name.ilike.${companyName.replace(/,/g, ' ')}`,
            email ? `email.eq.${email}` : null,
          ]
            .filter(Boolean)
            .join(','),
        )
        .limit(1)
      existing = (data?.[0] as Client) ?? null
    }

    if (existing) {
      const updates: UpdateClientData = {}
      if (!existing.whatsapp && phone) updates.whatsapp = phone
      if (!existing.email && email) updates.email = email
      if (!existing.responsible && input.responsible)
        updates.responsible = input.responsible
      if (!existing.city && input.city) updates.city = input.city
      if (!existing.state && input.state) updates.state = input.state
      if (!existing.address && input.address) updates.address = input.address

      if (Object.keys(updates).length > 0) {
        return updateClient(existing.id, updates)
      }
      return existing
    }

    // 2) cria um cliente novo com o que está disponível
    return createClient({
      company_name: companyName,
      responsible: input.responsible ?? undefined,
      whatsapp: phone ?? undefined,
      email: email ?? undefined,
      address: input.address ?? undefined,
      city: input.city ?? undefined,
      state: input.state ?? undefined,
      created_by_user_id: ownerUserId,
    })
  } catch (err) {
    console.warn('ensureClientFromRoute falhou (ignorado):', err)
    return null
  }
}

