'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

export default function RegisterConfirmandoPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [errorText, setErrorText] = useState('')

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setErrorText('Informe seu e-mail')
      return
    }
    setMessage('sending')
    setErrorText('')
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      })
      if (error) {
        setMessage('error')
        setErrorText(error.message || 'Não foi possível reenviar o e-mail.')
        return
      }
      setMessage('success')
    } catch {
      setMessage('error')
      setErrorText('Erro ao reenviar. Tente novamente.')
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
        <div className="bg-white rounded-lg shadow-lg p-6 md:p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <Mail className="w-8 h-8 text-gray-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Verifique sua caixa de entrada</h1>
          <p className="text-sm text-gray-600 mb-6">
            Enviamos um link de confirmação para o e-mail informado. Clique no link para ativar sua conta e acessar o
            painel.
          </p>
          <p className="text-xs text-gray-500 mb-6">
            Não recebeu? Confira a pasta de spam ou reenvie o e-mail abaixo.
          </p>

          <form onSubmit={handleResend} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
            />
            <button
              type="submit"
              disabled={message === 'sending'}
              className="w-full py-2.5 px-4 rounded-lg font-medium bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {message === 'sending' ? (
                <span className="flex items-center justify-center gap-2">
                  <div
                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                    aria-hidden
                  />
                  Reenviando…
                </span>
              ) : (
                'Reenviar e-mail de confirmação'
              )}
            </button>
          </form>

          {message === 'success' && (
            <p className="mt-3 text-sm text-green-600">E-mail reenviado. Verifique sua caixa de entrada.</p>
          )}
          {message === 'error' && errorText && (
            <p className="mt-3 text-sm text-red-600">{errorText}</p>
          )}

          <div className="mt-6 pt-4 border-t border-gray-200">
            <Link
              href="/login"
              className="text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              Voltar ao login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
