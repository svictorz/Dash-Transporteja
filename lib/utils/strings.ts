/**
 * Utilidades para comparação resiliente de strings.
 *
 * Usadas para casar nomes de empresa / cidade ignorando diferenças de
 * caixa e acentuação ("Padaria do João" === "padaria do joao").
 */

/**
 * Versão "fold" do texto:
 * - remove acentos (Unicode NFD + strip diacríticos)
 * - converte para minúsculas
 * - normaliza espaços (consecutivos → 1, trim)
 *
 * Diferente do normalize() do IBGE, NÃO remove pontuação — para evitar
 * que "JS Logística & Cia." vire match com "JS Logística e Cia.".
 */
export function foldText(value?: string | null): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Compara dois textos ignorando acentos, caixa e espaços extras.
 * Retorna false quando algum dos lados é vazio (evita match acidental
 * entre strings vazias).
 */
export function equalsFold(a?: string | null, b?: string | null): boolean {
  const fa = foldText(a)
  const fb = foldText(b)
  if (!fa || !fb) return false
  return fa === fb
}
