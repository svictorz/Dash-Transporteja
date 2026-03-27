import { supabase } from '@/lib/supabase/client'

export interface LGPDRequest {
  id: string
  user_id: string
  request_type: 'export' | 'delete' | 'rectification' | 'portability'
  status: 'pending' | 'processing' | 'completed' | 'rejected' | 'cancelled'
  requested_data?: any
  response_data?: any
  created_at: string
  updated_at: string
}

export interface Consent {
  id: string
  user_id: string
  consent_type: 'cookies' | 'location' | 'camera' | 'analytics' | 'marketing'
  granted: boolean
  created_at: string
  updated_at: string
}

/**
 * Exporta todos os dados pessoais do usuário
 */
export async function exportUserData(): Promise<any> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      throw new Error('Usuário não autenticado')
    }

    // Chamar função SQL para exportar dados
    const { data, error } = await supabase.rpc('export_user_data', {
      p_user_id: session.user.id
    })

    if (error) throw error

    // Criar solicitação LGPD
    await createLGPDRequest('export', { exported: true })

    return data
  } catch (error: any) {
    console.error('Erro ao exportar dados:', error)
    throw new Error(error.message || 'Erro ao exportar dados')
  }
}

/**
 * Exclui todos os dados pessoais do usuário (direito ao esquecimento)
 */
export async function deleteUserData(): Promise<any> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      throw new Error('Usuário não autenticado')
    }

    // Criar solicitação LGPD antes de deletar
    const request = await createLGPDRequest('delete', { requested: true })

    // Chamar função SQL para deletar dados
    const { data, error } = await supabase.rpc('delete_user_data', {
      p_user_id: session.user.id
    })

    if (error) throw error

    // Atualizar status da solicitação
    await updateLGPDRequestStatus(request.id, 'completed', data)

    // Fazer logout após exclusão
    await supabase.auth.signOut()

    return data
  } catch (error: any) {
    console.error('Erro ao excluir dados:', error)
    throw new Error(error.message || 'Erro ao excluir dados')
  }
}

/**
 * Cria uma solicitação LGPD
 */
export async function createLGPDRequest(
  requestType: 'export' | 'delete' | 'rectification' | 'portability',
  requestedData?: any
): Promise<LGPDRequest> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      throw new Error('Usuário não autenticado')
    }

    const { data, error } = await supabase
      .from('lgpd_requests')
      .insert({
        user_id: session.user.id,
        request_type: requestType,
        status: 'pending',
        requested_data: requestedData
      })
      .select()
      .single()

    if (error) throw error

    return data
  } catch (error: any) {
    console.error('Erro ao criar solicitação LGPD:', error)
    throw new Error(error.message || 'Erro ao criar solicitação')
  }
}

/**
 * Atualiza o status de uma solicitação LGPD
 */
export async function updateLGPDRequestStatus(
  requestId: string,
  status: 'pending' | 'processing' | 'completed' | 'rejected' | 'cancelled',
  responseData?: any
): Promise<void> {
  try {
    const { error } = await supabase
      .from('lgpd_requests')
      .update({
        status,
        response_data: responseData,
        processed_at: new Date().toISOString()
      })
      .eq('id', requestId)

    if (error) throw error
  } catch (error: any) {
    console.error('Erro ao atualizar solicitação LGPD:', error)
    throw new Error(error.message || 'Erro ao atualizar solicitação')
  }
}

/**
 * Obtém todas as solicitações LGPD do usuário
 */
export async function getUserLGPDRequests(): Promise<LGPDRequest[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      throw new Error('Usuário não autenticado')
    }

    const { data, error } = await supabase
      .from('lgpd_requests')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return data || []
  } catch (error: any) {
    console.error('Erro ao buscar solicitações LGPD:', error)
    throw new Error(error.message || 'Erro ao buscar solicitações')
  }
}

/**
 * Obtém consentimentos do usuário
 */
export async function getUserConsents(): Promise<Consent[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return []
    }

    const { data, error } = await supabase
      .from('user_consents')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return data || []
  } catch (error: any) {
    console.error('Erro ao buscar consentimentos:', error)
    return []
  }
}

/**
 * Atualiza consentimento do usuário
 */
export async function updateConsent(
  consentType: 'cookies' | 'location' | 'camera' | 'analytics' | 'marketing',
  granted: boolean
): Promise<Consent> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      throw new Error('Usuário não autenticado')
    }

    const { data, error } = await supabase
      .from('user_consents')
      .upsert({
        user_id: session.user.id,
        consent_type: consentType,
        granted,
        user_agent: typeof window !== 'undefined' ? navigator.userAgent : null
      })
      .select()
      .single()

    if (error) throw error

    return data
  } catch (error: any) {
    console.error('Erro ao atualizar consentimento:', error)
    throw new Error(error.message || 'Erro ao atualizar consentimento')
  }
}

/**
 * Obtém logs de acesso a dados pessoais
 */
export async function getDataAccessLogs(limit: number = 50): Promise<any[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return []
    }

    const { data, error } = await supabase
      .from('data_access_logs')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return data || []
  } catch (error: any) {
    console.error('Erro ao buscar logs de acesso:', error)
    return []
  }
}

