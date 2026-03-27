/**
 * Encryption Service
 * 
 * Este módulo fornece funções para trabalhar com dados criptografados
 * do banco de dados. A criptografia real é feita no backend (SQL).
 */

import { supabase } from '@/lib/supabase/client'

/**
 * Descriptografa dados sensíveis do banco de dados
 * Usa as views descriptografadas do Supabase
 */
export async function getDecryptedDriverData(driverId: string) {
  try {
    // Usar view descriptografada (se disponível)
    // Caso contrário, usar tabela normal (dados podem não estar criptografados ainda)
    const { data, error } = await supabase
      .from('drivers_decrypted')
      .select('*')
      .eq('id', driverId)
      .single()

    if (error) {
      // Fallback para tabela normal se view não existir
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('drivers')
        .select('*')
        .eq('id', driverId)
        .single()

      if (fallbackError) throw fallbackError
      return fallbackData
    }

    return data
  } catch (error: any) {
    console.error('Erro ao obter dados descriptografados:', error)
    throw new Error(error.message || 'Erro ao descriptografar dados')
  }
}

/**
 * Descriptografa dados de cliente
 */
export async function getDecryptedClientData(clientId: string) {
  try {
    const { data, error } = await supabase
      .from('clients_decrypted')
      .select('*')
      .eq('id', clientId)
      .single()

    if (error) {
      // Fallback para tabela normal
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single()

      if (fallbackError) throw fallbackError
      return fallbackData
    }

    return data
  } catch (error: any) {
    console.error('Erro ao obter dados descriptografados:', error)
    throw new Error(error.message || 'Erro ao descriptografar dados')
  }
}

/**
 * Migra dados existentes para formato criptografado
 * (Apenas para administradores)
 */
export async function migrateDataToEncrypted() {
  try {
    const { data, error } = await supabase.rpc('migrate_existing_data_to_encrypted')

    if (error) throw error

    return data
  } catch (error: any) {
    console.error('Erro ao migrar dados:', error)
    throw new Error(error.message || 'Erro ao migrar dados para formato criptografado')
  }
}

/**
 * Verifica se dados estão criptografados
 */
export function isEncrypted(value: string | null | undefined): boolean {
  if (!value) return false
  
  // Dados criptografados são base64 e começam com caracteres específicos
  // Esta é uma verificação básica
  try {
    // Tentar decodificar base64
    const decoded = atob(value)
    // Se conseguir decodificar e tiver tamanho razoável, provavelmente está criptografado
    return decoded.length > 0 && value.length > 20
  } catch {
    return false
  }
}

