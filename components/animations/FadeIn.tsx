import { ReactNode, CSSProperties } from 'react'

interface FadeInProps {
  children: ReactNode
  delay?: number
  duration?: number
  direction?: 'up' | 'down' | 'left' | 'right' | 'none'
  className?: string
}

/**
 * Fade-in com CSS puro (não usa framer-motion).
 *
 * Por quê: este componente é instanciado dezenas de vezes por página, e
 * cada motion.div da API do framer-motion executa lógica em JS no main
 * thread por toda a duração da animação. Em 3G/celular básico isso
 * compete com hidratação, fetch e renderização → engasga visível.
 *
 * Usando @keyframes nativo o navegador anima na thread de composição
 * (GPU). Mantém a mesma API e respeita `prefers-reduced-motion` via CSS.
 */
const directionMap: Record<NonNullable<FadeInProps['direction']>, string> = {
  up: 'translate3d(0, 16px, 0)',
  down: 'translate3d(0, -16px, 0)',
  left: 'translate3d(16px, 0, 0)',
  right: 'translate3d(-16px, 0, 0)',
  none: 'translate3d(0, 0, 0)',
}

export default function FadeIn({
  children,
  delay = 0,
  duration = 0.45,
  direction = 'up',
  className = '',
}: FadeInProps) {
  const style = {
    '--fade-from': directionMap[direction],
    '--fade-duration': `${duration}s`,
    '--fade-delay': `${delay}s`,
  } as CSSProperties

  return (
    <div className={`fade-in-css ${className}`} style={style}>
      {children}
    </div>
  )
}
