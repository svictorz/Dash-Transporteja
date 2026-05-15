/** Opções fixas para datas numéricas no padrão brasileiro (dd/mm/aaaa). */
export const DATE_BR_NUMERIC: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}

/**
 * Interpreta `yyyy-mm-dd` puro (ex.: campo date do formulário) como meia-noite
 * **local** — evita o bug de `new Date('2026-05-13')` em UTC mostrar o dia
 * anterior no Brasil. Strings com hora/fuso (ISO completo) usam `Date` normal.
 */
export function parseDateFlexible(value: string): Date | null {
  const s = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
    if (!m) return null
    const y = Number(m[1])
    const mo = Number(m[2])
    const d = Number(m[3])
    if (!y || !mo || !d) return null
    const dt = new Date(y, mo - 1, d)
    return isNaN(dt.getTime()) ? null : dt
  }
  const dt = new Date(s)
  return isNaN(dt.getTime()) ? null : dt
}

/** Formata data para exibição em `dd/mm/aaaa` (pt-BR). */
export function formatDateDdMmYyyy(input: string | null | undefined): string {
  if (input == null || !String(input).trim()) return ''
  const raw = String(input).trim()
  const dt = parseDateFlexible(raw)
  if (!dt) return raw
  return dt.toLocaleDateString('pt-BR', DATE_BR_NUMERIC)
}
