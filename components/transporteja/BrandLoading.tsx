'use client'

interface BrandLoadingProps {
  message?: string
  className?: string
  fullScreen?: boolean
}

/** Loading compartilhado pelas transições e pela verificação de sessão. */
export default function BrandLoading({ message = 'Carregando…', className = '', fullScreen = true }: BrandLoadingProps) {
  return <div className={`${fullScreen ? 'min-h-screen' : 'min-h-[40vh]'} flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-[#0c1930] ${className}`}>
    <div role="status" aria-live="polite" className="flex w-full max-w-sm flex-col items-center px-6 py-10 text-center">
      <div className="brand-mark relative flex h-24 w-44 items-center justify-center rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_12px_35px_-18px_rgba(37,99,235,0.45)] dark:border-slate-700 dark:bg-white dark:shadow-[0_12px_35px_-18px_rgba(59,130,246,0.4)]">
        <img src="/logo-jcn-preto.png" alt="JCN Logística" className="h-full w-full object-contain" />
      </div>
      <div className="relative mt-8 h-12 w-64 max-w-full" aria-hidden="true">
        <div className="absolute inset-x-5 top-3.5 h-0.5 bg-slate-200 dark:bg-slate-700" />
        <div className="brand-route absolute left-5 right-5 top-3.5 h-0.5 origin-left bg-gradient-to-r from-blue-500 to-emerald-500" />
        <div className="absolute left-2 top-1.5 h-4 w-4 rounded-full border-[3px] border-blue-500 bg-white ring-4 ring-blue-100 dark:bg-slate-900 dark:ring-blue-950" />
        <div className="brand-stop-end absolute right-2 top-1.5 h-4 w-4 rounded-full border-[3px] border-emerald-500 bg-white ring-4 ring-emerald-100 dark:bg-slate-900 dark:ring-emerald-950" />
        <div className="brand-truck absolute left-4 top-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-md shadow-blue-500/25">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M3 6h11v10H3zM14 9h3l3 3v4h-6z" /><circle cx="7" cy="17" r="1.5" /><circle cx="17" cy="17" r="1.5" /></svg>
        </div>
        <span className="absolute bottom-0 left-0 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Coleta</span>
        <span className="absolute bottom-0 right-0 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Entrega</span>
      </div>
      <p className="mt-5 text-sm font-semibold text-slate-700 dark:text-slate-200">{message || 'Carregando…'}</p>
      <span className="sr-only">Aguarde enquanto o sistema carrega.</span>
    </div>
    <style jsx>{`
      .brand-mark { animation: mark-enter 450ms cubic-bezier(.16,1,.3,1) both; }
      .brand-route { animation: route-progress 2.4s ease-in-out infinite; }
      .brand-truck { animation: truck-route 2.4s ease-in-out infinite; }
      .brand-stop-end { animation: arrival 2.4s ease-in-out infinite; }
      @keyframes mark-enter { from { opacity: 0; transform: translateY(8px) scale(.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
      @keyframes route-progress { 0%, 8% { transform: scaleX(0); } 70%, 88% { transform: scaleX(1); } 100% { transform: scaleX(0); } }
      @keyframes truck-route { 0%, 8% { opacity: 0; transform: translateX(0); } 12% { opacity: 1; } 70%, 88% { opacity: 1; transform: translateX(212px); } 100% { opacity: 0; transform: translateX(212px); } }
      @keyframes arrival { 0%, 65%, 100% { transform: scale(1); } 76% { transform: scale(1.35); } }
      @media (prefers-reduced-motion: reduce) { .brand-mark, .brand-route, .brand-truck, .brand-stop-end { animation: none; } .brand-truck { transform: translateX(106px); } .brand-route { transform: scaleX(.5); } }
    `}</style>
  </div>
}
