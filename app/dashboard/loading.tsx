'use client'

export default function DashboardLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-slate-100">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-slate-800 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-600">Carregando…</p>
      </div>
    </div>
  )
}
