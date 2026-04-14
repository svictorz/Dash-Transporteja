/**
 * Saldo de créditos (legado / opcional na tabela users).
 * A plataforma não bloqueia uso por saldo; o trigger de débito no Supabase pode ser desativado (migração 010).
 */

import { supabase } from '@/lib/supabase/client'

export interface CreditsState {
  credits: number | null
  loading: boolean
}

/**
 * Busca o saldo de créditos do usuário logado.
 * Retorna null se a coluna ainda não existir ou o usuário não estiver logado.
 */
export async function fetchUserCredits(userId: string): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('credits_balance')
      .eq('id', userId)
      .single()

    if (error || !data) return null
    const value = (data as { credits_balance?: number }).credits_balance
    if (typeof value !== 'number') return null
    return value >= 0 ? value : 0
  } catch {
    return null
  }
}

/** Legado: antes 10 créditos por rota quando o trigger debitava saldo. */
export const CREDITS_PER_ROUTE = 10

/** Sempre permite criar rota (SaaS sem bloqueio por saldo). */
export async function canCreateRoute(_userId: string): Promise<{ ok: boolean; error?: string }> {
  return { ok: true }
}
