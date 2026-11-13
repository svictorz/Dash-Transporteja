const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const dashboard = fs.readFileSync(path.resolve(__dirname, '../components/dashboard/DashboardOverview.tsx'), 'utf8')

assert.doesNotMatch(dashboard, /Composição do frete/)
console.log('PASS: dashboard does not render the freight composition section')
