'use client'

import type { PropostaDocConfig } from '@/lib/constants/proposta-emitentes'

const navy = '#0f2847'

interface Props {
  doc: PropostaDocConfig
}

export default function PropostaBrandLogo({ doc }: Props) {
  return (
    <p className={`font-black text-xl tracking-tight leading-none ${doc.logoClassName ?? ''}`} style={{ color: navy }}>
      {doc.logoFallbackText}
    </p>
  )
}
