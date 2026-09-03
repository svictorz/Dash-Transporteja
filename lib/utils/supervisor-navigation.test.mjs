import test from 'node:test'
import assert from 'node:assert/strict'
import { canSupervisorAccessPanelPath } from './roles.ts'

test('supervisor can access operational panel routes', () => {
  for (const path of [
    '/inicio',
    '/clientes',
    '/rotas',
    '/rotas/nova',
    '/propostas',
    '/calendario',
    '/performance',
    '/configuracoes',
    '/dados-pessoais',
  ]) {
    assert.equal(canSupervisorAccessPanelPath(path), true, path)
  }
})

test('supervisor cannot access financial control or permissions', () => {
  for (const path of [
    '/controle-financeiro',
    '/controle-financeiro/detalhes',
    '/usuarios',
    '/usuarios/novo',
  ]) {
    assert.equal(canSupervisorAccessPanelPath(path), false, path)
  }
})
