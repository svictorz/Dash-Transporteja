'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import FadeIn from '@/components/animations/FadeIn'
import ImageCropper from '@/components/ImageCropper'
import {
  Shield,
  User,
  Mail,
  Phone,
  Camera,
  Save,
  Loader2,
  X
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { uploadAvatar, base64ToBlob } from '@/lib/supabase/storage'

interface UserProfile {
  id: string
  name: string | null
  email: string
  phone: string | null
  avatar_url: string | null
}

export default function DadosPessoaisPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showCropper, setShowCropper] = useState(false)
  const [cropperImage, setCropperImage] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      setIsLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user) {
        return
      }

      // Buscar dados do usuário
      const { data: userData, error } = await supabase
        .from('users')
        .select('id, name, email, phone, avatar_url')
        .eq('id', session.user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao carregar perfil:', error)
        // Usar dados do auth como fallback
        setProfile({
          id: session.user.id,
          name: session.user.email?.split('@')[0] || null,
          email: session.user.email || '',
          phone: null,
          avatar_url: null
        })
        return
      }

      if (userData) {
        setProfile({
          id: userData.id,
          name: userData.name || null,
          email: userData.email || session.user.email || '',
          phone: userData.phone || null,
          avatar_url: userData.avatar_url || null
        })
      } else {
        // Criar perfil se não existir
        const { data: newUser } = await supabase
          .from('users')
          .insert({
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.email?.split('@')[0] || null
          })
          .select()
          .single()

        if (newUser) {
          setProfile({
            id: newUser.id,
            name: newUser.name || null,
            email: newUser.email || '',
            phone: null,
            avatar_url: null
          })
        }
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione uma imagem')
      return
    }

    // Validar tamanho (2MB)
    const maxSize = 2 * 1024 * 1024 // 2MB
    if (file.size > maxSize) {
      alert('A imagem é muito grande. O tamanho máximo é 2MB.')
      return
    }

    // Ler arquivo como data URL
    const reader = new FileReader()
    reader.onloadend = () => {
      setCropperImage(reader.result as string)
      setShowCropper(true)
    }
    reader.readAsDataURL(file)
  }

  const handleCropComplete = async (croppedImage: string) => {
    try {
      setIsSaving(true)
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user || !profile) return

      // Converter base64 para blob
      const blob = base64ToBlob(croppedImage, 'image/jpeg')
      
      // Upload para Supabase Storage
      const avatarUrl = await uploadAvatar(blob, session.user.id)

      // Atualizar perfil no banco
      const { error } = await supabase
        .from('users')
        .update({ avatar_url: avatarUrl })
        .eq('id', session.user.id)

      if (error) {
        throw error
      }

      // Atualizar estado local
      setProfile({ ...profile, avatar_url: avatarUrl })
      setShowCropper(false)
      setCropperImage('')
      
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error: any) {
      console.error('Erro ao salvar foto:', error)
      alert(`Erro ao salvar foto: ${error.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSave = async () => {
    if (!profile) return

    try {
      setIsSaving(true)
      const { error } = await supabase
        .from('users')
        .update({
          name: profile.name,
          phone: profile.phone || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id)

      if (error) {
        throw error
      }

      alert('Perfil atualizado com sucesso!')
    } catch (error: any) {
      console.error('Erro ao salvar perfil:', error)
      alert(`Erro ao salvar perfil: ${error.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-800" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Erro ao carregar perfil</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <FadeIn delay={0.1}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dados Pessoais</h1>
            <p className="text-sm text-gray-500 mt-1">Gerencie suas informações pessoais</p>
          </div>
        </div>
      </FadeIn>

      {/* Formulário de Perfil */}
      <FadeIn delay={0.2}>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Foto de Perfil */}
            <div className="flex-shrink-0">
              <div className="relative">
                <div className="w-32 h-32 rounded-full bg-gray-100 border-4 border-white shadow-lg overflow-hidden flex items-center justify-center">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Foto de perfil"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                      }}
                    />
                  ) : (
                    <User className="w-16 h-16 text-gray-400" />
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-lg"
                  title="Alterar foto"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Máximo 2MB
              </p>
            </div>

            {/* Campos do Formulário */}
            <div className="flex-1 space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Nome
                </label>
                <input
                  type="text"
                  value={profile.name || ''}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Seu nome completo"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  E-mail
                </label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">O e-mail não pode ser alterado</p>
              </div>

              {/* Telefone */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Telefone
                </label>
                <input
                  type="tel"
                  value={profile.phone || ''}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="(00) 00000-0000"
                />
              </div>

              {/* Botão Salvar */}
              <div className="pt-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Salvar Alterações
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Modal de Recorte */}
      {showCropper && (
        <ImageCropper
          image={cropperImage}
          onCrop={handleCropComplete}
          onCancel={() => {
            setShowCropper(false)
            setCropperImage('')
            if (fileInputRef.current) {
              fileInputRef.current.value = ''
            }
          }}
          aspectRatio={1}
          maxSize={2}
        />
      )}
    </div>
  )
}

