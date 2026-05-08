/**
 * @deprecated O `freight_id` agora é gerado pelo banco via sequence
 * (`routes_freight_id_seq`, definida na migration 017). A partir dela, novas
 * rotas recebem números em ordem crescente começando em 0.
 *
 * Função mantida apenas para compatibilidade caso outro fluxo precise de
 * um identificador local antes do insert. Prefira deixar `freight_id`
 * indefinido no `createRoute` para usar a sequence.
 */
export function generateFreightCode(): number {
  return Math.floor(100_000 + Math.random() * 900_000)
}
