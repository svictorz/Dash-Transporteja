'use client'

import { useState, useEffect } from 'react'
import { Shield, Check, X, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ConfiguracoesPage() {
  const router = useRouter()
  const [security, setSecurity] = useState({
    twoFactor: false
  })

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  })
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Carregar configurações salvas
  useEffect(() => {
    const savedSecurity = localStorage.getItem('securitySettings')
    if (savedSecurity) {
      setSecurity(JSON.parse(savedSecurity))
    }
  }, [])

  // Salvar configurações de segurança
  const handleSecurityChange = (key: keyof typeof security, value: boolean) => {
    const updated = { ...security, [key]: value }
    setSecurity(updated)
    localStorage.setItem('securitySettings', JSON.stringify(updated))
  }

  // Alterar senha
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('Por favor, preencha todos os campos')
      return
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('A nova senha deve ter pelo menos 6 caracteres')
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('As senhas não coincidem')
      return
    }

    setIsChangingPassword(true)

    try {
      // Verificar senha atual fazendo login
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user?.email) {
        setPasswordError('Usuário não encontrado')
        setIsChangingPassword(false)
        return
      }

      // Tentar fazer login com a senha atual para validar
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordForm.currentPassword
      })

      if (signInError) {
        setPasswordError('Senha atual incorreta')
        setIsChangingPassword(false)
        return
      }

      // Atualizar senha
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      })

      if (updateError) {
        setPasswordError(updateError.message || 'Erro ao alterar senha')
        setIsChangingPassword(false)
        return
      }

      setPasswordSuccess('Senha alterada com sucesso!')
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })

      setTimeout(() => {
        setPasswordSuccess('')
      }, 3000)
    } catch (err: any) {
      setPasswordError(err.message || 'Erro ao alterar senha')
    } finally {
      setIsChangingPassword(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-600 mt-1">Gerencie as configurações do sistema</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Segurança */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-orange-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Segurança</h2>
          </div>

          <div className="space-y-6">
            {/* Autenticação de Dois Fatores */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Autenticação de Dois Fatores</p>
                <p className="text-xs text-gray-500">Adicione uma camada extra de segurança</p>
              </div>
              <button
                onClick={() => handleSecurityChange('twoFactor', !security.twoFactor)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  security.twoFactor ? 'bg-orange-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    security.twoFactor ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Alterar Senha */}
            <div className="pt-4 border-t border-gray-200">
              <h3 className="font-medium text-gray-900 mb-4">Alterar Senha</h3>
              
              <form onSubmit={handlePasswordChange} className="space-y-4">
                {/* Senha Atual */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Senha Atual
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.current ? 'text' : 'password'}
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 pr-10"
                      placeholder="Digite sua senha atual"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Nova Senha */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nova Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.new ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 pr-10"
                      placeholder="Mínimo 6 caracteres"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Confirmar Senha */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirmar Nova Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.confirm ? 'text' : 'password'}
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 pr-10"
                      placeholder="Confirme sua nova senha"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Mensagens de Erro/Sucesso */}
                {passwordError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <AlertCircle className="w-4 h-4" />
                    {passwordError}
                  </div>
                )}

                {passwordSuccess && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                    <Check className="w-4 h-4" />
                    {passwordSuccess}
                  </div>
                )}

                {/* Botão de Enviar */}
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isChangingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Alterando...
                    </>
                  ) : (
                    'Alterar Senha'
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

