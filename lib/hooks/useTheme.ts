'use client'

import { useCallback, useEffect, useState } from 'react'
import { THEME_STORAGE_KEY, type ThemePreference } from '@/lib/constants/theme'

function readStoredTheme(): ThemePreference {
  if (typeof window === 'undefined') return 'light'
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    return v === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function applyDomTheme(theme: ThemePreference) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

/**
 * Tema claro / escuro (`class="dark"` no `<html>`).
 * Preferência salva em `localStorage` (`THEME_STORAGE_KEY`).
 */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemePreference>('light')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const stored = readStoredTheme()
    setThemeState(stored)
    applyDomTheme(stored)
    setReady(true)
  }, [])

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
    applyDomTheme(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: ThemePreference = prev === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next)
      } catch {
        /* ignore */
      }
      applyDomTheme(next)
      return next
    })
  }, [])

  return { theme, setTheme, toggleTheme, ready }
}
