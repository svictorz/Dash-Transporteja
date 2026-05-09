'use client'

import Image from 'next/image'

interface BrandLoadingProps {
  /** Texto opcional abaixo do logo. Padrão: "Carregando…" */
  message?: string
  /** Classe extra para customizar o container externo. */
  className?: string
  /** Quando true, ocupa a tela inteira; senão usa min-h-[40vh] (padrão = true). */
  fullScreen?: boolean
}

/**
 * Tela de carregamento padrão com o logo da marca e animações sutis:
 * - Anel girando ao redor do logo (carregamento ativo)
 * - Pulsação leve do logo (respiração)
 * - Mensagem com fade-in sequencial
 *
 * Usado tanto em transições do App Router (`loading.tsx`) quanto em estados
 * de "verificando autenticação" / carregando perfil.
 */
export default function BrandLoading({
  message = 'Carregando…',
  className = '',
  fullScreen = true,
}: BrandLoadingProps) {
  return (
    <div
      className={`${
        fullScreen ? 'min-h-screen' : 'min-h-[40vh]'
      } flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-slate-100 ${className}`}
    >
      <div className="flex flex-col items-center gap-5 px-6 text-center">
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center">
          {/* Anel girando atrás do logo */}
          <div className="absolute inset-0 rounded-full border-2 border-slate-200" aria-hidden />
          <div
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-slate-800 animate-spin"
            style={{ animationDuration: '1.4s' }}
            aria-hidden
          />
          {/* Halo suave pulsante */}
          <div
            className="absolute inset-2 rounded-full bg-slate-900/5 animate-pulse"
            style={{ animationDuration: '2.2s' }}
            aria-hidden
          />
          {/* Logo */}
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 brand-logo-float">
            <Image
              src="/logo-header.png"
              alt="JCN x Ágape"
              fill
              priority
              sizes="96px"
              className="object-contain drop-shadow-sm"
            />
          </div>
        </div>

        {message ? (
          <p className="text-sm text-gray-600 font-medium tracking-tight brand-loading-fade">
            {message}
          </p>
        ) : null}
      </div>

      <style jsx>{`
        @keyframes brand-float {
          0%,
          100% {
            transform: translateY(0) scale(1);
            opacity: 0.95;
          }
          50% {
            transform: translateY(-3px) scale(1.03);
            opacity: 1;
          }
        }
        .brand-logo-float {
          animation: brand-float 2.4s ease-in-out infinite;
        }

        @keyframes brand-fade {
          0% {
            opacity: 0;
            transform: translateY(4px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .brand-loading-fade {
          animation: brand-fade 0.6s ease-out 0.15s both;
        }
      `}</style>
    </div>
  )
}
