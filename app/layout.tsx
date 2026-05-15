import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import dynamic from 'next/dynamic'
import Script from 'next/script'
import './globals.css'
import { THEME_STORAGE_KEY } from '@/lib/constants/theme'

// Lazy-load do banner de cookies. Ele importa framer-motion + lucide-react;
// fora do bundle inicial, todas as páginas (login, register, legais) ficam
// mais leves. ssr:false porque o estado depende de localStorage.
const ConsentBanner = dynamic(() => import('@/components/ConsentBanner'), {
  ssr: false,
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Gestão Operacional | OP TRANSPORTES',
  description: 'Gestão logística, cotações e acompanhamento de operações',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
}

// Configuração de viewport — separada do metadata desde Next 14.
// `width=device-width, initial-scale=1` é o default, mas explicitar evita
// que o Safari/Chrome móvel use heurísticas estranhas em viewports curtos.
// `themeColor` controla a cor do address bar / status bar em mobile.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#1f2937' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
  colorScheme: 'light dark',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <Script id="theme-init" strategy="beforeInteractive">
          {`try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);document.documentElement.classList.toggle('dark',t==='dark');}catch(e){}`}
        </Script>
        {children}
        <ConsentBanner />
      </body>
    </html>
  )
}

