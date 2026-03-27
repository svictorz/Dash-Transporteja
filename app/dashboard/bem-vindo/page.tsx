'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Phone, FileText, Loader2, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { searchCNPJ } from '@/lib/services/cnpj'
import { validatePhone } from '@/lib/utils/validation'
import FadeIn from '@/components/animations/FadeIn'
import { BRAND_NAME } from '@/lib/constants/brand'

const WELCOME_CREDITS = 5

export default function BemVindoPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [phone, setPhone] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [cnpjSearching, setCnpjSearching] = useState(false)
  const [cnpjError, setCnpjError] = useState('')
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    ensureUserAndCheckOnboarding()
  }, [])

  async function ensureUserAndCheckOnboarding() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.replace('/login')
        return
      }

      const { data: userRow, error: fetchError } = await supabase
        .from('users')
        .select('id, onboarding_completed, company_name, company_cnpj, phone')
        .eq('id', session.user.id)
        .single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        setSubmitError('Erro ao carregar dados. Tente novamente.')
        setLoading(false)
        return
      }

      if (userRow?.onboarding_completed) {
        router.replace('/dashboard')
        return
      }

      if (!userRow) {
        const meta = session.user.user_metadata || {}
        const { error: insertError } = await supabase.from('users').insert({
          id: session.user.id,
          email: session.user.email ?? '',
          name: meta.name ?? session.user.email?.split('@')[0] ?? null,
          role: 'comercial',
          terms_accepted_at: meta.terms_accepted_at ?? null,
        })
        if (insertError) {
          setSubmitError('Erro ao criar perfil. Tente novamente.')
          setLoading(false)
          return
        }
      } else {
        setPhone(userRow.phone ?? '')
        setCompanyName(userRow.company_name ?? '')
        setCnpj(userRow.company_cnpj ?? '')
      }

      setLoading(false)
    } catch {
      setSubmitError('Erro inesperado. Tente novamente.')
      setLoading(false)
    }
  }

  const handleSearchCnpj = async () => {
    const raw = cnpj.replace(/\D/g, '')
    if (raw.length !== 14) {
      setCnpjError('CNPJ deve ter 14 dígitos')
      return
    }
    setCnpjError('')
    setCnpjSearching(true)
    try {
      const result = await searchCNPJ(cnpj)
      if (result.success) {
        setCompanyName(result.data.companyName)
        setCnpj(result.data.cnpj)
      } else {
        setCnpjError(result.error)
      }
    } catch {
      setCnpjError('Erro ao consultar CNPJ. Tente novamente.')
    } finally {
      setCnpjSearching(false)
    }
  }

  const handleConcluir = async () => {
    if (phone.trim()) {
      const phoneCheck = validatePhone(phone)
      if (!phoneCheck.valid) {
        setSubmitError(phoneCheck.error ?? 'Telefone inválido')
        return
      }
    }
    setSubmitError('')
    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.replace('/login')
        return
      }

      await supabase
        .from('users')
        .update({
          phone: phone.trim() || null,
          company_name: companyName.trim() || null,
          company_cnpj: cnpj.replace(/\D/g, '').length === 14 ? cnpj.trim() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.user.id)

      const { error: rpcError } = await supabase.rpc('complete_onboarding', {
        welcome_credits: WELCOME_CREDITS,
      })
      if (rpcError) {
        setSubmitError(rpcError.message || 'Erro ao concluir. Tente novamente.')
        setSubmitting(false)
        return
      }
      router.replace('/dashboard')
    } catch {
      setSubmitError('Erro ao salvar. Tente novamente.')
      setSubmitting(false)
    }
  }

  const handlePular = async () => {
    setSubmitError('')
    setSubmitting(true)
    try {
      const { error } = await supabase.rpc('complete_onboarding', {
        welcome_credits: WELCOME_CREDITS,
      })
      if (error) {
        setSubmitError(error.message || 'Erro ao continuar. Tente novamente.')
        setSubmitting(false)
        return
      }
      router.replace('/dashboard')
    } catch {
      setSubmitError('Erro inesperado. Tente novamente.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-800" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <FadeIn delay={0.1}>
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Bem-vindo — {BRAND_NAME}</h1>
          <p className="text-gray-600 mt-2">
            Conte um pouco sobre sua empresa (opcional). Você já receberá {WELCOME_CREDITS} créditos para criar suas
            primeiras rotas.
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={0.2}>
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Telefone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 00000-0000"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              CNPJ da empresa
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={cnpj}
                onChange={(e) => {
                  setCnpj(e.target.value)
                  setCnpjError('')
                }}
                placeholder="00.000.000/0001-00"
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleSearchCnpj}
                disabled={cnpjSearching}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50"
              >
                {cnpjSearching ? 'Buscando…' : 'Buscar'}
              </button>
            </div>
            {cnpjError && <p className="mt-1 text-sm text-red-600">{cnpjError}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Nome da empresa
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Razão social ou nome fantasia"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {submitError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{submitError}</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={handleConcluir}
              disabled={submitting}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Concluir
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handlePular}
              disabled={submitting}
              className="px-4 py-3 text-gray-600 hover:text-gray-900 font-medium disabled:opacity-50"
            >
              Pular por agora
            </button>
          </div>
        </div>
      </FadeIn>

      <p className="text-center text-sm text-gray-500">
        Você poderá editar esses dados depois em Dados Pessoais ou Configurações.
      </p>
    </div>
  )
}
