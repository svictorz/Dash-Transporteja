/**
 * Gera um código de frete numérico aleatório (9 dígitos).
 * Usado como identificador único do frete para rastreio e login do motorista (placa + código).
 * Faixa: 100.000.000 a 999.999.999 (evita colisões e é fácil de digitar).
 */
export function generateFreightCode(): number {
  return Math.floor(100_000_000 + Math.random() * 900_000_000)
}
