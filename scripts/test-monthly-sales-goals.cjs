const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const calls = []
const response = { user_id: 'seller-1', month: '2026-11-01', amount: 100000, net_amount: 20000 }
const supabase = {
  from(table) {
    assert.equal(table, 'monthly_sales_goals')
    return {
      upsert(payload, options) {
        calls.push({ payload, options })
        return { select() { return { single: async () => ({ data: response, error: null }) } } }
      },
    }
  },
}
const context = {
  exports: {},
  require(name) {
    if (name === '@/lib/supabase/client') return { supabase }
    if (name === '@/lib/utils/roles') return { PANEL_ROLES: ['admin', 'comercial'] }
    return require(name)
  },
}
const filename = path.join(root, 'lib/services/monthly-sales-goals.ts')
vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context, { filename })

;(async () => {
  const saved = await context.exports.saveMonthlySalesGoal('seller-1', '2026-11-01', 100000, 20000)
  assert.deepEqual(JSON.parse(JSON.stringify(saved)), response)
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), {
    payload: { user_id: 'seller-1', month: '2026-11-01', amount: 100000, net_amount: 20000 },
    options: { onConflict: 'user_id,month' },
  })
  await assert.rejects(() => context.exports.saveMonthlySalesGoal('seller-1', '2026-11-01', 100000, 0), /lucro líquido/i)
  await assert.rejects(() => context.exports.saveMonthlySalesGoal('seller-1', '2026-11-01', 100000, 1e12), /lucro líquido/i)
  console.log('PASS: monthly sales goal persists an optional positive net target')
})().catch(error => { console.error(error); process.exitCode = 1 })
