'use client'

import Link from 'next/link'
import { ShieldCheck, ArrowLeft, Mail } from 'lucide-react'
import { BRAND_NAME } from '@/lib/constants/brand'

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-slate-100 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 p-6 sm:p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-slate-800 text-white flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-7 h-7" aria-hidden />
        </div>
        <h1 className="text-xl font-bold text-gray-900">
          Acesso ao {BRAND_NAME}
        </h1>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          O cadastro de novas contas é feito apenas por um administrador.
          Solicite seu acesso pelo canal interno da empresa.
        </p>

        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left">
          <p className="text-xs uppercase tracking-wide font-semibold text-amber-800 flex items-center gap-1">
            <Mail className="w-3.5 h-3.5" aria-hidden />
            Já tem conta?
          </p>
          <p className="text-sm text-amber-900 mt-1">
            Entre normalmente com seu e-mail e senha.
          </p>
        </div>

        <Link
          href="/login"
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-white text-sm font-medium hover:bg-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden />
          Ir para o login
        </Link>
      </div>
    </div>
  )
}
