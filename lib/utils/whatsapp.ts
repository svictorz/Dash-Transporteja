/** Abre conversa no WhatsApp Web (`send?phone=` com DDI 55 quando ausente). */
export function getWhatsAppWebUrl(phone?: string | null): string | null {
  const digits = phone?.replace(/\D/g, '') || ''
  if (!digits) return null
  const normalized = digits.startsWith('55') ? digits : `55${digits}`
  return `https://web.whatsapp.com/send?phone=${normalized}`
}
