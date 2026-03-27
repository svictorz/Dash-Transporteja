'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function HomePage() {
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let isMounted = true
    
    // Verificar se o usuário já está logado
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!isMounted) return
        
        if (session) {
          router.replace('/dashboard')
        } else {
          router.replace('/login')
        }
        
        setChecked(true)
      } catch (error) {
        console.error('Erro ao verificar sessão:', error)
        if (isMounted) {
          router.replace('/login')
          setChecked(true)
        }
      }
    }
    
    checkSession()
    
    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-slate-800 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Carregando...</p>
      </div>
    </div>
  )
}

