'use client'

import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'

interface CaptchaProps {
  onVerify: (isValid: boolean) => void
}

export default function Captcha({ onVerify }: CaptchaProps) {
  const [num1, setNum1] = useState(0)
  const [num2, setNum2] = useState(0)
  const [answer, setAnswer] = useState('')
  const [isValid, setIsValid] = useState(false)
  const [error, setError] = useState('')

  const generateCaptcha = () => {
    const n1 = Math.floor(Math.random() * 10) + 1
    const n2 = Math.floor(Math.random() * 10) + 1
    setNum1(n1)
    setNum2(n2)
    setAnswer('')
    setIsValid(false)
    setError('')
    onVerify(false)
  }

  useEffect(() => {
    generateCaptcha()
  }, [])

  const handleAnswerChange = (value: string) => {
    setAnswer(value)
    setError('')
    
    if (value === '') {
      setIsValid(false)
      onVerify(false)
      return
    }

    const userAnswer = parseInt(value, 10)
    if (!isNaN(userAnswer) && userAnswer === num1 + num2) {
      setIsValid(true)
      setError('')
      onVerify(true)
    } else {
      setIsValid(false)
      onVerify(false)
      if (value !== '' && !isNaN(userAnswer)) {
        setError('Resposta incorreta')
      }
    }
  }

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        Verificação de Segurança
      </label>
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center justify-center gap-2 p-2.5 bg-gray-50 border border-gray-300 rounded-lg">
          <span className="text-base font-semibold text-gray-800">{num1}</span>
          <span className="text-gray-500">+</span>
          <span className="text-base font-semibold text-gray-800">{num2}</span>
          <span className="text-gray-500">=</span>
          <input
            type="text"
            inputMode="numeric"
            value={answer}
            onChange={(e) => handleAnswerChange(e.target.value)}
            className="w-14 text-center text-base font-medium border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
            placeholder="?"
          />
        </div>
        <button
          type="button"
          onClick={generateCaptcha}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          title="Gerar novo captcha"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
      {isValid && (
        <p className="mt-1 text-xs text-green-600">✓ Verificado</p>
      )}
    </div>
  )
}

