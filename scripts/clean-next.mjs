/**
 * Remove .next e node_modules/.cache (chunks webpack desatualizados → ex. Cannot find module './682.js').
 * Uso: node scripts/clean-next.mjs   ou   npm run clean
 */
import { rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
for (const rel of ['.next', join('node_modules', '.cache')]) {
  const p = join(root, rel)
  if (existsSync(p)) {
    rmSync(p, { recursive: true, force: true })
    console.log('Removido:', rel)
  }
}
console.log('Pronto. Execute npm run dev ou npm run build.')
