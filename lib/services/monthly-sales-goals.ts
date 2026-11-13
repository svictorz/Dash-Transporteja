import { supabase } from '@/lib/supabase/client'
import { PANEL_ROLES } from '@/lib/utils/roles'

export type MonthlySalesGoal = { user_id: string; month: string; amount: number; net_amount: number | null }
export type GoalSeller = { id: string; name: string | null; email: string; role: string }

export async function getMonthlySalesGoals(userId: string, month: string, admin: boolean) {
  let query = supabase.from('monthly_sales_goals').select('user_id, month, amount, net_amount').eq('month', month)
  if (!admin) query = query.eq('user_id', userId)
  const [goals, sellers] = await Promise.all([
    query,
    admin ? supabase.from('users').select('id, name, email, role').in('role', [...PANEL_ROLES, 'operator']).order('name') : Promise.resolve({ data: [], error: null }),
  ])
  if (goals.error) throw new Error('Não foi possível carregar as metas mensais. Tente atualizar o painel.')
  if (sellers.error) throw new Error('Não foi possível carregar os vendedores.')
  return { goals: (goals.data ?? []) as MonthlySalesGoal[], sellers: (sellers.data ?? []) as GoalSeller[] }
}

export async function saveMonthlySalesGoal(userId: string, month: string, amount: number, netAmount: number | null = null) {
  if (!/^\d{4}-\d{2}-01$/.test(month) || !Number.isFinite(amount) || amount <= 0 || amount > 999999999999.99) throw new Error('Informe uma meta mensal válida, maior que zero.')
  if (netAmount !== null && (!Number.isFinite(netAmount) || netAmount <= 0 || netAmount > 999999999999.99)) throw new Error('Informe uma meta de lucro líquido válida, maior que zero.')
  const { data, error } = await supabase.from('monthly_sales_goals').upsert({ user_id: userId, month, amount, net_amount: netAmount }, { onConflict: 'user_id,month' }).select('user_id, month, amount, net_amount').single()
  if (error) throw new Error('Não foi possível salvar a meta. Somente administradores podem definir metas.')
  return data as MonthlySalesGoal
}
