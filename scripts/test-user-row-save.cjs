// Exercises the real page handlers; only hooks and external persistence are replaced.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const root = path.resolve(__dirname, '..')
const seller = { id: 'seller', name: 'Vendedor', email: 'seller@example.invalid', role: 'comercial', commission_rate: 30 }

function harness(superAdmin = true) {
  const state = [], calls = [], cache = new Map()
  let cursor = 0, failGoal = false
  const goals = []
  const react = { ...React, useState(initial) {
    const index = cursor++
    if (!(index in state)) state[index] = index === 0 ? [seller] : index === 1 ? false : typeof initial === 'function' ? initial() : initial
    return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value }]
  }, useEffect() {}, useMemo: fn => fn() }
  function load(file) {
    const filename = path.resolve(root, file)
    if (cache.has(filename)) return cache.get(filename)
    const context = { exports: {}, setTimeout() {}, window: { dispatchEvent() {} }, CustomEvent: class {}, require(name) {
      if (name === 'react') return react
      if (name === 'next/navigation') return { useRouter: () => ({ refresh() {}, replace() {} }) }
      if (name === '@/lib/hooks/useCurrentUser') return { useCurrentUser: () => ({ user: { id: 'admin', role: 'admin', email: 'admin@example.invalid' }, loading: false }) }
      if (name === '@/lib/utils/roles') return { isSuperAdminEmail: email => superAdmin && email === 'admin@example.invalid', dashboardRoleLabel: role => role }
      if (name === '@/lib/hooks/useMonthlySalesGoals') return { useMonthlySalesGoals: () => ({ goals, loading: false, error: null, refresh: async () => {} }) }
      if (name === '@/lib/services/monthly-sales-goals') return { saveMonthlySalesGoal: async (userId, month, amount) => {
        calls.push({ kind: 'goal', userId, month, amount })
        if (failGoal) throw Error('Falha ao salvar meta')
        goals.push({ user_id: userId, month, amount })
      } }
      if (name === '@/lib/supabase/client') return { supabase: {} }
      if (name.startsWith('@/')) return load(name.slice(2) + '.ts')
      if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts')))
      return require(name)
    }, fetch: async (url, options) => {
      const payload = JSON.parse(options.body)
      calls.push({ kind: 'profile', ...payload })
      return { ok: true, json: async () => ({ user: { ...seller, role: payload.role ?? seller.role, commission_rate: payload.commissionRate ?? seller.commission_rate } }) }
    } }
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText, context, { filename })
    cache.set(filename, context.exports)
    return context.exports
  }
  const Page = load('app/(painel)/usuarios/page.tsx').default
  function render() { cursor = 0; return Page() }
  function nodes(node, predicate) {
    if (!React.isValidElement(node)) return []
    return [...(predicate(node) ? [node] : []), ...React.Children.toArray(node.props.children).flatMap(child => nodes(child, predicate))]
  }
  const find = (predicate) => { const result = nodes(render(), predicate)[0]; assert.ok(result, 'Expected control not found'); return result.props }
  return { calls, render, find, failGoal(value) { failGoal = value } }
}

;(async () => {
  const page = harness()
  const role = () => page.find(node => node.type === 'select' && node.props['aria-label'] === 'Permissão de Vendedor')
  role().onChange({ target: { value: 'operacional' } })
  const commission = page.find(node => node.props['aria-label'] === 'Comissão de Vendedor')
  commission.onChange({ target: { value: '22.5' } })
  if (commission.onBlur) await commission.onBlur()
  const goal = () => page.find(node => node.props['aria-label'] === 'Meta mensal de Vendedor')
  goal().onChange({ target: { value: '10000' } })
  assert.equal(page.calls.length, 0, 'Editing or leaving fields must not persist before Save')
  const save = () => page.find(node => node.type === 'button' && node.props['aria-label'] === 'Salvar alterações de Vendedor')
  page.failGoal(true)
  await save().onClick()
  assert.deepEqual(page.calls[0], { kind: 'profile', userId: 'seller', role: 'operacional', commissionRate: 22.5 })
  assert.equal(page.calls[1].amount, 10000)
  assert.equal(goal().value, '10000', 'Failed goal must keep its draft for retry')
  page.failGoal(false)
  await save().onClick()
  assert.equal(page.calls.filter(call => call.kind === 'profile').length, 1, 'Retry must not resend the already saved profile')
  assert.equal(save().disabled, true, 'No pending changes after successful save')

  const invalid = harness()
  invalid.find(node => node.props['aria-label'] === 'Permissão de Vendedor').onChange({ target: { value: 'fiscal' } })
  invalid.find(node => node.props['aria-label'] === 'Meta mensal de Vendedor').onChange({ target: { value: '0' } })
  await invalid.find(node => node.props['aria-label'] === 'Salvar alterações de Vendedor').onClick()
  assert.equal(invalid.calls.length, 0, 'Validate all drafts before any persistence')
  invalid.find(node => node.props['aria-label'] === 'Meta mensal de Vendedor').onChange({ target: { value: '' } })
  await invalid.find(node => node.props['aria-label'] === 'Salvar alterações de Vendedor').onClick()
  assert.equal(invalid.calls.length, 1, 'Clearing an unset goal must allow saving just the permission')
  assert.equal(invalid.calls[0].role, 'fiscal')

  const admin = harness(false)
  assert.equal(admin.find(node => node.props['aria-label'] === 'Permissão de Vendedor').disabled, true)
  assert.equal(admin.find(node => node.props['aria-label'] === 'Comissão de Vendedor').disabled, true)
  admin.find(node => node.props['aria-label'] === 'Meta mensal de Vendedor').onChange({ target: { value: '5000' } })
  await admin.find(node => node.props['aria-label'] === 'Salvar alterações de Vendedor').onClick()
  assert.equal(admin.calls.length, 1)
  assert.equal(admin.calls[0].kind, 'goal')
  console.log('PASS: explicit row save, combined profile changes, goal retry, validation before writes and unchanged admin restrictions')
})().catch(error => { console.error(error); process.exitCode = 1 })
