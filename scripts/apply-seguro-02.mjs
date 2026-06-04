/**
 * Aplica seguro 0,2% (sobre a NF) em TODOS os fretes existentes, mantendo os
 * tributos atuais. Recalcula frete líquido e comissão (seguro desconta).
 *
 *   node scripts/apply-seguro-02.mjs           # DRY-RUN (não grava)
 *   node scripts/apply-seguro-02.mjs --apply   # grava
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const SEG = 0.2
const DEFAULT_COMMISSION_RATE = 30
const APPLY = process.argv.includes('--apply')

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
  if (m) env[m[1]] = m[2]
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const round2 = (n) => Math.round(n * 100) / 100

async function main() {
  const { data: users } = await supabase.from('users').select('id, commission_rate')
  const rateById = new Map(users.map((u) => [u.id, u.commission_rate]))

  const { data: routes, error } = await supabase
    .from('routes')
    .select('id, freight_id, freight_value, nf_value, driver_value, taxes_value, taxes_percent, seguro_percent, seguro_value, net_freight_value, commission_value, created_by_user_id')
  if (error) throw error

  let changed = 0, skipped = 0, negatives = 0
  const sums = { seg: 0, oldNet: 0, newNet: 0, oldComm: 0, newComm: 0 }

  for (const r of routes) {
    const baseFreight = r.freight_value ?? r.nf_value
    if (baseFreight == null) { skipped++; continue }
    const rate = (r.created_by_user_id ? rateById.get(r.created_by_user_id) : null) ?? DEFAULT_COMMISSION_RATE
    // Mantém tributos atuais (usa valor gravado ou recalcula pelo percent atual).
    const taxesValue = r.taxes_value ?? round2(baseFreight * ((r.taxes_percent ?? 18) / 100))
    const seguroValue = r.nf_value != null ? round2(r.nf_value * (SEG / 100)) : 0
    const net = round2(baseFreight - taxesValue - (r.driver_value ?? 0) - seguroValue)
    const comm = round2(net * (rate / 100))
    if (net < 0) negatives++

    changed++
    sums.seg += seguroValue
    sums.oldNet += r.net_freight_value ?? 0
    sums.newNet += net
    sums.oldComm += r.commission_value ?? 0
    sums.newComm += comm

    if (APPLY) {
      const { error: upErr } = await supabase.from('routes').update({
        seguro_percent: SEG,
        seguro_value: seguroValue,
        net_freight_value: net,
        commission_value: comm,
      }).eq('id', r.id)
      if (upErr) { console.error(`#${r.freight_id}:`, upErr.message); process.exitCode = 1 }
    }
  }

  console.log(`\n${APPLY ? '*** APLICADO ***' : '=== DRY-RUN (nada gravado) ==='}`)
  console.log(`Total: ${routes.length} | atualizados: ${changed} | ignorados: ${skipped}`)
  console.log(`Fretes com líquido negativo após: ${negatives}`)
  console.log(`\nTotais:`)
  console.log(`  Seguro (0,2%):  ${round2(sums.seg)}`)
  console.log(`  Líquido:  ${round2(sums.oldNet)} → ${round2(sums.newNet)}`)
  console.log(`  Comissão: ${round2(sums.oldComm)} → ${round2(sums.newComm)}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
