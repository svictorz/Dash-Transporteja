'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { validateEmail } from '@/lib/utils/validation'
import { BRAND_NAME } from '@/lib/constants/brand'

const RESET_REDIRECT = '/auth/callback?next=/login/nova-senha'

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    const emailCheck = validateEmail(email.trim())
    if (!emailCheck.valid) {
      setErrorMessage(emailCheck.error ?? 'E-mail inválido')
      return
    }

    setStatus('sending')
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${origin}${RESET_REDIRECT}`,
      })
      if (error) {
        setStatus('error')
        setErrorMessage(error.message)
        return
      }
      setStatus('success')
    } catch {
      setStatus('error')
      setErrorMessage('Erro ao enviar. Tente novamente.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 relative overflow-hidden flex items-center justify-center p-4">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.8) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.8) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-6 md:p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-header.png"
                alt={BRAND_NAME}
                className="h-12 w-auto max-w-[220px] object-contain"
              />
            </div>
            <h2 className="text-lg font-bold text-gray-800 mb-1">Recuperar senha</h2>
            <p className="text-xs text-gray-500">
              Informe seu e-mail e enviaremos as instruções para redefinir sua senha.
            </p>
          </div>

          {status === 'success' ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-gray-600">
                Se o e-mail estiver cadastrado, você receberá as instruções em breve. Verifique sua caixa de entrada e
                a pasta de spam.
              </p>
              <Link
                href="/login"
                className="inline-block w-full py-2.5 px-4 rounded-lg font-medium bg-gray-900 text-white hover:bg-gray-800 text-center"
              >
                Voltar ao login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  E-mail
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                  required
                />
              </div>

              {status === 'error' && errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{errorMessage}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={status === 'sending'}
                className="w-full bg-gray-900 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'sending' ? (
                  <span className="flex items-center justify-center gap-2">
                    <div
                      className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
                      aria-hidden
                    />
                    Enviando…
                  </span>
                ) : (
                  'Enviar instruções'
                )}
              </button>
            </form>
          )}

          {status !== 'success' && (
            <div className="mt-5 text-center">
              <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">
                Voltar ao login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
