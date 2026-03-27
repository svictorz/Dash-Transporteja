/**
 * Serviço de créditos do usuário.
 * Quando a coluna credits_balance existir na tabela users no Supabase,
 * o consumo será debitado ao criar rota (e exibido no dashboard).
 * @see docs/PLAN-CREDITOS-E-SEGURANCA.md
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

/** Quantidade de créditos consumidos por nova rota (deve bater com o trigger no Supabase). */
export const CREDITS_PER_ROUTE = 10

/**
 * Verifica se o usuário tem créditos para criar uma rota.
 * Cada nova rota consome CREDITS_PER_ROUTE (10) créditos.
 */
export async function canCreateRoute(userId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const current = await fetchUserCredits(userId)
    if (current === null) {
      return { ok: true }
    }
    if (current < CREDITS_PER_ROUTE) {
      return {
        ok: false,
        error: `Saldo de créditos insuficiente. Cada rota consome ${CREDITS_PER_ROUTE} créditos. Adquira mais créditos para criar rotas.`,
      }
    }
    return { ok: true }
  } catch {
    return { ok: true }
  }
}
