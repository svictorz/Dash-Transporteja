'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Envolve um conteúdo largo (tabela) com rolagem horizontal e adiciona uma
 * barra de rolagem que "gruda" na base da viewport enquanto o conteúdo está
 * visível — assim o usuário não precisa rolar até o fim da página para
 * encontrar a barra horizontal.
 *
 * A barra de baixo é sincronizada com a rolagem real do conteúdo (nos dois
 * sentidos). A barra nativa do conteúdo é ocultada para não duplicar.
 */
export default function StickyScrollX({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [overflowing, setOverflowing] = useState(false)

  useEffect(() => {
    const sc = scrollRef.current
    const bar = barRef.current
    const inner = innerRef.current
    if (!sc || !bar || !inner) return

    const sync = () => {
      inner.style.width = `${sc.scrollWidth}px`
      setOverflowing(sc.scrollWidth > sc.clientWidth + 1)
    }
    sync()

    let lock = false
    const onContent = () => {
      if (lock) return
      lock = true
      bar.scrollLeft = sc.scrollLeft
      lock = false
    }
    const onBar = () => {
      if (lock) return
      lock = true
      sc.scrollLeft = bar.scrollLeft
      lock = false
    }

    sc.addEventListener('scroll', onContent, { passive: true })
    bar.addEventListener('scroll', onBar, { passive: true })

    const ro = new ResizeObserver(sync)
    ro.observe(sc)
    if (sc.firstElementChild) ro.observe(sc.firstElementChild)
    window.addEventListener('resize', sync)

    return () => {
      sc.removeEventListener('scroll', onContent)
      bar.removeEventListener('scroll', onBar)
      ro.disconnect()
      window.removeEventListener('resize', sync)
    }
  }, [])

  return (
    <div className={`relative ${className}`}>
      <div
        ref={scrollRef}
        className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <div
        ref={barRef}
        aria-hidden
        className={`sticky bottom-0 left-0 z-20 overflow-x-auto border-t border-gray-200/70 bg-white/90 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90 ${
          overflowing ? '' : 'hidden'
        }`}
      >
        <div ref={innerRef} className="h-3" />
      </div>
    </div>
  )
}
