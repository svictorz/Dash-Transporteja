'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Erro capturado:', error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Algo deu errado</h2>
      <p className="text-sm text-gray-600 text-center max-w-md mb-6">
        Ocorreu um erro inesperado. Tente recarregar a página.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:ring-offset-2"
      >
        Tentar novamente
      </button>
    </div>
  )
}
