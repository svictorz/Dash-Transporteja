/** Chave única no `localStorage` para persistir claro / escuro. */
export const THEME_STORAGE_KEY = 'transporteja-theme' as const

export type ThemePreference = 'light' | 'dark'
