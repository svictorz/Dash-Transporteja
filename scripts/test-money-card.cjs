// Render the actual existing page component without loading its authenticated hooks.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { Eye, EyeOff } = require('lucide-react')
const financialContext = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/utils/freight-financials.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, financialContext)
const page = ts.createSourceFile('page.tsx', fs.readFileSync('app/(painel)/performance/page.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const component = page.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'MoneyValueRow')
assert.ok(component)
const context = { React, Eye, EyeOff, ...financialContext.exports }
vm.runInNewContext(ts.transpileModule(component.getText(page), {
  compilerOptions: { jsx: ts.JsxEmit.React },
}).outputText, context)
const render = (props) => renderToStaticMarkup(React.createElement(context.MoneyValueRow, {
  value: 19571.4, totalFreightValue: 111030, visible: true, onToggle() {}, ...props,
}))
assert.ok(render().includes('17,6%'))
assert.ok(!render({ visible: false }).includes('17,6%'))
assert.ok(!render({ totalFreightValue: undefined }).includes('17,6%'))
assert.ok(!render({ totalFreightValue: 0 }).includes('NaN'))
console.log('PASS: card displays percentage, hides it with private values and handles an empty total')
