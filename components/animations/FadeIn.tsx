'use client'

import { motion } from 'framer-motion'
import { ReactNode, useEffect, useState, useMemo } from 'react'

interface FadeInProps {
  children: ReactNode
  delay?: number
  duration?: number
  direction?: 'up' | 'down' | 'left' | 'right' | 'none'
  className?: string
}

export default function FadeIn({
  children,
  delay = 0,
  duration = 0.6,
  direction = 'up',
  className = '',
}: FadeInProps) {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const variants = useMemo(
    () => ({
      hidden: {
        opacity: reducedMotion ? 1 : 0,
        y: reducedMotion ? 0 : direction === 'up' ? 20 : direction === 'down' ? -20 : 0,
        x: reducedMotion ? 0 : direction === 'left' ? 20 : direction === 'right' ? -20 : 0,
      },
      visible: {
        opacity: 1,
        y: 0,
        x: 0,
        transition: {
          duration: reducedMotion ? 0 : duration,
          delay: reducedMotion ? 0 : delay,
          ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
        },
      },
    }),
    [direction, duration, delay, reducedMotion]
  )

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={variants}
      className={className}
    >
      {children}
    </motion.div>
  )
}

