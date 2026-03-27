/**
 * Utilitários de validação para o sistema TransporteJá
 * Garante integridade dos dados e previne tentativas de burlar o sistema
 */

/**
 * Valida formato de telefone brasileiro
 * Aceita: (11) 99999-9999, (11) 9999-9999, 11999999999, etc.
 */
export function validatePhone(phone: string): { valid: boolean; error?: string; formatted?: string } {
  if (!phone || phone.trim() === '') {
    return { valid: false, error: 'Telefone é obrigatório' }
  }

  // Remove caracteres não numéricos
  const cleanPhone = phone.replace(/\D/g, '')

  // Verifica se tem 10 ou 11 dígitos (com ou sem DDD)
  if (cleanPhone.length < 10 || cleanPhone.length > 11) {
    return { valid: false, error: 'Telefone deve ter 10 ou 11 dígitos (com DDD)' }
  }

  // Verifica se começa com 0 (não permitido)
  if (cleanPhone.startsWith('0')) {
    return { valid: false, error: 'Telefone não pode começar com 0' }
  }

  // Formata telefone: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
  let formatted = cleanPhone
  if (cleanPhone.length === 11) {
    formatted = `(${cleanPhone.slice(0, 2)}) ${cleanPhone.slice(2, 7)}-${cleanPhone.slice(7)}`
  } else if (cleanPhone.length === 10) {
    formatted = `(${cleanPhone.slice(0, 2)}) ${cleanPhone.slice(2, 6)}-${cleanPhone.slice(6)}`
  }

  return { valid: true, formatted }
}

/**
 * Valida formato de email
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || email.trim() === '') {
    return { valid: false, error: 'Email é obrigatório' }
  }

  // Regex para validar email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Email inválido' }
  }

  // Bloqueio de e-mails temporários/descartáveis (reduz fraude e dados fake)
  const tempEmailDomains = [
    'tempmail.com',
    '10minutemail.com',
    'guerrillamail.com',
    'mailinator.com',
    'throwaway.email',
    'temp-mail.org',
    'fakeinbox.com',
    'trashmail.com',
    'yopmail.com',
    'getnada.com',
    'mailnesia.com',
    'sharklasers.com',
    'guerrillamailblock.com',
    'discard.email',
    'tempr.email',
    'emailondeck.com',
    'mohmal.com',
    'inboxkitten.com',
    'dispostable.com',
    'maildrop.cc',
    'tmpmail.org',
    'minuteinbox.com',
    'tempinbox.com',
    'dropmail.me',
    'mintemail.com',
    'emailfake.com',
    'generator.email',
  ]
  
  const domain = email.split('@')[1]?.toLowerCase()
  if (domain && tempEmailDomains.some(temp => domain.includes(temp))) {
    return { valid: false, error: 'E-mails temporários ou descartáveis não são permitidos' }
  }

  // Verifica tamanho máximo
  if (email.length > 255) {
    return { valid: false, error: 'Email muito longo (máximo 255 caracteres)' }
  }

  return { valid: true }
}

/**
 * Valida nome completo
 * Deve ter pelo menos 2 palavras (nome e sobrenome)
 */
export function validateName(name: string): { valid: boolean; error?: string; formatted?: string } {
  if (!name || name.trim() === '') {
    return { valid: false, error: 'Nome é obrigatório' }
  }

  // Remove espaços extras
  const trimmedName = name.trim().replace(/\s+/g, ' ')

  // Verifica tamanho mínimo
  if (trimmedName.length < 3) {
    return { valid: false, error: 'Nome deve ter pelo menos 3 caracteres' }
  }

  // Verifica tamanho máximo
  if (trimmedName.length > 100) {
    return { valid: false, error: 'Nome muito longo (máximo 100 caracteres)' }
  }

  // Verifica se tem pelo menos 2 palavras (nome e sobrenome)
  const words = trimmedName.split(' ').filter(w => w.length > 0)
  if (words.length < 2) {
    return { valid: false, error: 'Digite nome completo (nome e sobrenome)' }
  }

  // Verifica se cada palavra tem pelo menos 2 caracteres
  for (const word of words) {
    if (word.length < 2) {
      return { valid: false, error: 'Cada parte do nome deve ter pelo menos 2 caracteres' }
    }
  }

  // Verifica se contém apenas letras, espaços e caracteres acentuados
  const nameRegex = /^[a-zA-ZÀ-ÿ\s]+$/
  if (!nameRegex.test(trimmedName)) {
    return { valid: false, error: 'Nome deve conter apenas letras' }
  }

  // Capitaliza primeira letra de cada palavra
  const formatted = words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')

  return { valid: true, formatted }
}

/**
 * Valida senha para cadastro e redefinição.
 * Mínimo 8 caracteres, ao menos 1 letra e 1 número.
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Senha é obrigatória' }
  }
  if (password.length < 8) {
    return { valid: false, error: 'A senha deve ter pelo menos 8 caracteres' }
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, error: 'A senha deve conter pelo menos uma letra' }
  }
  if (!/\d/.test(password)) {
    return { valid: false, error: 'A senha deve conter pelo menos um número' }
  }
  if (password.length > 72) {
    return { valid: false, error: 'Senha muito longa' }
  }
  return { valid: true }
}

/**
 * Valida nome de empresa (razão social ou nome fantasia).
 * Reduz nomes fake: exige tamanho mínimo, rejeita só números ou caracteres suspeitos.
 */
export function validateCompanyName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Nome da empresa é obrigatório' }
  }

  const trimmed = name.trim()

  if (trimmed.length < 3) {
    return { valid: false, error: 'Nome da empresa deve ter pelo menos 3 caracteres' }
  }

  if (trimmed.length > 150) {
    return { valid: false, error: 'Nome da empresa muito longo (máximo 150 caracteres)' }
  }

  // Rejeita se for só números e espaços
  if (/^[\d\s]+$/.test(trimmed)) {
    return { valid: false, error: 'Nome da empresa não pode conter apenas números' }
  }

  // Deve conter pelo menos uma letra
  if (!/[a-zA-ZÀ-ÿ]/.test(trimmed)) {
    return { valid: false, error: 'Nome da empresa deve conter letras' }
  }

  return { valid: true }
}

/**
 * Valida formato de CEP brasileiro
 */
export function validateCEP(cep: string): { valid: boolean; error?: string; formatted?: string } {
  if (!cep || cep.trim() === '') {
    return { valid: false, error: 'CEP é obrigatório' }
  }

  // Remove caracteres não numéricos
  const cleanCEP = cep.replace(/\D/g, '')

  // Verifica se tem 8 dígitos
  if (cleanCEP.length !== 8) {
    return { valid: false, error: 'CEP deve ter 8 dígitos' }
  }

  // Verifica se não é um CEP inválido (todos zeros, etc)
  if (cleanCEP === '00000000' || cleanCEP === '11111111' || cleanCEP === '22222222' || 
      cleanCEP === '33333333' || cleanCEP === '44444444' || cleanCEP === '55555555' ||
      cleanCEP === '66666666' || cleanCEP === '77777777' || cleanCEP === '88888888' || 
      cleanCEP === '99999999') {
    return { valid: false, error: 'CEP inválido' }
  }

  // Formata CEP: XXXXX-XXX
  const formatted = `${cleanCEP.slice(0, 5)}-${cleanCEP.slice(5)}`

  return { valid: true, formatted }
}

/**
 * Valida CNH (Carteira Nacional de Habilitação)
 */
export function validateCNH(cnh: string): { valid: boolean; error?: string } {
  if (!cnh || cnh.trim() === '') {
    return { valid: false, error: 'CNH é obrigatória' }
  }

  // Remove caracteres não numéricos
  const cleanCNH = cnh.replace(/\D/g, '')

  // CNH deve ter 11 dígitos
  if (cleanCNH.length !== 11) {
    return { valid: false, error: 'CNH deve ter 11 dígitos' }
  }

  // Verifica se não é um CNH inválido (todos zeros, etc)
  if (cleanCNH === '00000000000' || /^(\d)\1{10}$/.test(cleanCNH)) {
    return { valid: false, error: 'CNH inválida' }
  }

  return { valid: true }
}

/**
 * Valida placa de veículo (formato antigo e Mercosul)
 */
export function validatePlate(plate: string): { valid: boolean; error?: string; formatted?: string } {
  if (!plate || plate.trim() === '') {
    return { valid: false, error: 'Placa é obrigatória' }
  }

  // Remove espaços e converte para maiúsculo
  const cleanPlate = plate.trim().toUpperCase().replace(/\s/g, '')

  // Formato antigo: ABC-1234 (3 letras + 4 números)
  const oldFormat = /^[A-Z]{3}-?\d{4}$/
  // Formato Mercosul: ABC1D23 (3 letras + 1 número + 1 letra + 2 números)
  const mercosulFormat = /^[A-Z]{3}\d[A-Z]\d{2}$/

  if (!oldFormat.test(cleanPlate) && !mercosulFormat.test(cleanPlate)) {
    return { valid: false, error: 'Placa inválida. Use formato ABC-1234 ou ABC1D23' }
  }

  // Formata placa
  let formatted = cleanPlate
  if (oldFormat.test(cleanPlate)) {
    formatted = cleanPlate.replace(/([A-Z]{3})(\d{4})/, '$1-$2')
  } else if (mercosulFormat.test(cleanPlate)) {
    formatted = cleanPlate.replace(/([A-Z]{3})(\d)([A-Z])(\d{2})/, '$1$2$3-$4')
  }

  return { valid: true, formatted }
}

/**
 * Valida CPF (opcional, para clientes)
 */
export function validateCPF(cpf: string): { valid: boolean; error?: string; formatted?: string } {
  if (!cpf || cpf.trim() === '') {
    return { valid: true } // CPF é opcional
  }

  // Remove caracteres não numéricos
  const cleanCPF = cpf.replace(/\D/g, '')

  // Verifica se tem 11 dígitos
  if (cleanCPF.length !== 11) {
    return { valid: false, error: 'CPF deve ter 11 dígitos' }
  }

  // Verifica se não é um CPF inválido (todos zeros, etc)
  if (/^(\d)\1{10}$/.test(cleanCPF)) {
    return { valid: false, error: 'CPF inválido' }
  }

  // Validação dos dígitos verificadores
  let sum = 0
  let remainder

  // Valida primeiro dígito
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i)
  }
  remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  if (remainder !== parseInt(cleanCPF.substring(9, 10))) {
    return { valid: false, error: 'CPF inválido' }
  }

  // Valida segundo dígito
  sum = 0
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i)
  }
  remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  if (remainder !== parseInt(cleanCPF.substring(10, 11))) {
    return { valid: false, error: 'CPF inválido' }
  }

  // Formata CPF: XXX.XXX.XXX-XX
  const formatted = cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')

  return { valid: true, formatted }
}

/**
 * Valida CNPJ (Cadastro Nacional de Pessoa Jurídica)
 */
export function validateCNPJ(cnpj: string): { valid: boolean; error?: string; formatted?: string } {
  if (!cnpj || cnpj.trim() === '') {
    return { valid: false, error: 'CNPJ é obrigatório' }
  }

  // Remove caracteres não numéricos
  const cleanCNPJ = cnpj.replace(/\D/g, '')

  // Verifica se tem 14 dígitos
  if (cleanCNPJ.length !== 14) {
    return { valid: false, error: 'CNPJ deve ter 14 dígitos' }
  }

  // Verifica se não é um CNPJ inválido (todos zeros, etc)
  if (/^(\d)\1{13}$/.test(cleanCNPJ)) {
    return { valid: false, error: 'CNPJ inválido' }
  }

  // Validação dos dígitos verificadores
  let length = cleanCNPJ.length - 2
  let numbers = cleanCNPJ.substring(0, length)
  const digits = cleanCNPJ.substring(length)
  let sum = 0
  let pos = length - 7

  // Valida primeiro dígito
  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--
    if (pos < 2) pos = 9
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(digits.charAt(0))) {
    return { valid: false, error: 'CNPJ inválido' }
  }

  // Valida segundo dígito
  length = length + 1
  numbers = cleanCNPJ.substring(0, length)
  sum = 0
  pos = length - 7

  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--
    if (pos < 2) pos = 9
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(digits.charAt(1))) {
    return { valid: false, error: 'CNPJ inválido' }
  }

  // Formata CNPJ: XX.XXX.XXX/XXXX-XX
  const formatted = cleanCNPJ.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')

  return { valid: true, formatted }
}

