'use client'

import type { PropostaDocConfig } from '@/lib/constants/proposta-emitentes'

const navy = '#0f2847'

interface Props {
  doc: PropostaDocConfig
}

export default function PropostaBrandLogo({ doc }: Props) {
  if (doc.logoSrc) {
    return (
      <img
        src={doc.logoSrc}
        alt={doc.logoFallbackText}
        className={`block ${doc.logoClassName ?? ''}`}
        style={{
          width: doc.logoWidth ?? '29mm',
          height: doc.logoHeight ?? '9mm',
          objectFit: 'contain',
          objectPosition: 'left top',
        }}
      />
    )
  }

  return (
    <p className={`font-black text-xl tracking-tight leading-none ${doc.logoClassName ?? ''}`} style={{ color: navy }}>
      {doc.logoFallbackText}
    </p>
  )
}
