'use client'

import { useState } from 'react'
import { MapPin, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { validateCEP } from '@/lib/utils/validation'
import { searchCEP, CEPData } from '@/lib/services/cep'

interface CEPInputProps {
  value: string
  onChange: (cep: string) => void
  onCEPFound?: (data: CEPData) => void
  error?: string
  required?: boolean
  /** Se true (padrão), busca ao completar 8 dígitos e no blur. Se false, só ao clicar em Buscar. */
  autoSearch?: boolean
  label?: string
}

export default function CEPInput({ 
  value, 
  onChange, 
  onCEPFound,
  error,
  required = false,
  autoSearch = true,
  label = 'CEP *'
}: CEPInputProps) {
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [isValid, setIsValid] = useState(false)


  const handleSearchCEP = async () => {
    if (!value || value.length !== 8) {
      setSearchError('CEP deve ter 8 dígitos')
      return
    }

    const validation = validateCEP(value)
    if (!validation.valid) {
      setSearchError(validation.error || 'CEP inválido')
      return
    }

    setIsSearching(true)
    setSearchError(null)

    try {
      const result = await searchCEP(value)
      
      if (result.success && result.data) {
        setIsValid(true)
        if (onCEPFound) {
          onCEPFound(result.data)
        }
        // Formata o CEP
        if (result.data.cep) {
          onChange(result.data.cep.replace(/\D/g, ''))
        }
      } else {
        setSearchError(result.error || 'CEP não encontrado')
        setIsValid(false)
      }
    } catch (err: any) {
      setSearchError('Erro ao buscar CEP. Tente novamente.')
      setIsValid(false)
    } finally {
      setIsSearching(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearchCEP()
    }
  }

  const handleBlur = () => {
    if (!autoSearch) return
    if (value.length === 8) {
      handleSearchCEP()
    }
  }

  // Auto-buscar quando CEP estiver completo
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value.replace(/\D/g, '')
    
    // Limita a 8 dígitos
    if (inputValue.length <= 8) {
      onChange(inputValue)
      setSearchError(null)
      setIsValid(false)
      
      // Auto-buscar quando completar 8 dígitos
      if (autoSearch && inputValue.length === 8) {
        // Pequeno delay para permitir que o usuário termine de digitar
        setTimeout(() => {
          handleSearchCEP()
        }, 300)
      }
    }
  }

  // Formata CEP para exibição
  const displayValue = value.length === 8 
    ? `${value.slice(0, 5)}-${value.slice(5)}`
    : value

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            required={required}
            value={displayValue}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            onBlur={handleBlur}
            maxLength={9}
            placeholder="00000-000"
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 pr-10 ${
              error || searchError
                ? 'border-red-300 focus:ring-red-500'
                : isValid
                ? 'border-green-300 focus:ring-green-500'
                : 'border-gray-300 focus:ring-slate-800'
            }`}
          />
          {isValid && (
            <CheckCircle2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-green-500" />
          )}
        </div>
        <button
          type="button"
          onClick={handleSearchCEP}
          disabled={isSearching || value.length !== 8}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSearching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <MapPin className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">Buscar</span>
        </button>
      </div>
      {(error || searchError) && (
        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error || searchError}
        </p>
      )}
      {isValid && !error && !searchError && (
        <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          CEP encontrado
        </p>
      )}
    </div>
  )
}

