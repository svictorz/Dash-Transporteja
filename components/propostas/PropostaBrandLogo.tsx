'use client'

import { useState } from 'react'
import type { PropostaDocConfig } from '@/lib/constants/proposta-emitentes'

const navy = '#0f2847'

interface Props {
  doc: PropostaDocConfig
}

export default function PropostaBrandLogo({ doc }: Props) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <p className="font-black text-xl tracking-tight leading-none" style={{ color: navy }}>
        {doc.logoFallbackText}
      </p>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={doc.logoSrc}
      alt={doc.nomeFantasia}
      className={`block w-auto object-contain object-left max-h-10 max-w-[56mm] ${doc.logoClassName ?? ''}`}
      onError={() => setFailed(true)}
    />
  )
}
