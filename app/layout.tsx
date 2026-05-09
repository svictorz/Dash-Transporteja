import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ConsentBanner from '@/components/ConsentBanner'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Gestão Operacional | Jcn | Ágape',
  description: 'Gestão logística, cotações e acompanhamento de operações',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className={inter.className}>
        {children}
        <ConsentBanner />
      </body>
    </html>
  )
}

