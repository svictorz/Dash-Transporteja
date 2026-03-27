'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, Package, Truck, MapPin, Clock, User, Building } from 'lucide-react'

export interface TimelineStep {
  id: string
  title: string
  description?: string
  status: 'completed' | 'active' | 'pending'
  date?: string
  timeAgo?: string
  icon?: React.ReactNode
  waitingFor?: 'candidate' | 'company'
}

interface TrackingTimelineProps {
  steps: TimelineStep[]
  activeColor?: 'purple' | 'orange' | 'blue' | 'green'
}

export default function TrackingTimeline({ steps, activeColor = 'purple' }: TrackingTimelineProps) {
  const colorClasses = {
    purple: {
      active: 'bg-purple-50 border-purple-200',
      icon: 'bg-purple-500',
      text: 'text-purple-700',
      dot: 'bg-purple-500'
    },
    orange: {
      active: 'bg-orange-50 border-orange-200',
      icon: 'bg-orange-500',
      text: 'text-orange-700',
      dot: 'bg-orange-500'
    },
    blue: {
      active: 'bg-blue-50 border-blue-200',
      icon: 'bg-blue-500',
      text: 'text-blue-700',
      dot: 'bg-blue-500'
    },
    green: {
      active: 'bg-green-50 border-green-200',
      icon: 'bg-green-500',
      text: 'text-green-700',
      dot: 'bg-green-500'
    }
  }

  const colors = colorClasses[activeColor]

  const formatDate = (dateString?: string) => {
    if (!dateString) return ''
    try {
      const date = new Date(dateString)
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
      const day = date.getDate().toString().padStart(2, '0')
      const month = months[date.getMonth()]
      const year = date.getFullYear()
      return `${day} ${month} ${year}`
    } catch {
      return dateString
    }
  }

  const getStepIcon = (step: TimelineStep) => {
    if (step.icon) return step.icon
    
    if (step.status === 'completed') {
      return <CheckCircle2 className="w-5 h-5 text-white" />
    }
    
    if (step.status === 'active') {
      if (step.waitingFor === 'candidate') {
        return <User className="w-5 h-5 text-white" />
      } else if (step.waitingFor === 'company') {
        return <Building className="w-5 h-5 text-white" />
      }
      return <Package className="w-5 h-5 text-white" />
    }
    
    return null
  }

  return (
    <div className="w-full bg-white rounded-xl shadow-lg border border-gray-200 p-4 md:p-6">
      <div className="space-y-4">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1
          const isActive = step.status === 'active'
          const isCompleted = step.status === 'completed'
          const isPending = step.status === 'pending'

          return (
            <div key={step.id} className="relative">
              {/* Linha conectora */}
              {!isLast && (
                <div
                  className={`absolute left-6 top-12 w-0.5 ${
                    isCompleted ? 'bg-teal-500' : 'bg-gray-200'
                  }`}
                  style={{ height: 'calc(100% + 1rem)' }}
                />
              )}

              <div className="flex items-start gap-4">
                {/* Ícone do passo */}
                <div className="relative z-10 flex-shrink-0">
                  {isCompleted ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-12 h-12 bg-teal-500 rounded-full flex items-center justify-center shadow-md"
                    >
                      {getStepIcon(step)}
                    </motion.div>
                  ) : isActive ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={`w-12 h-12 ${colors.icon} rounded-full flex items-center justify-center shadow-md`}
                    >
                      {getStepIcon(step)}
                    </motion.div>
                  ) : (
                    <div className="w-12 h-12 bg-white border-2 border-gray-300 rounded-full flex items-center justify-center">
                      {/* Círculo vazio para pendente */}
                    </div>
                  )}
                </div>

                {/* Conteúdo do passo */}
                <div className={`flex-1 pt-1 rounded-lg p-4 border-2 ${
                  isActive ? colors.active : 'border-transparent'
                }`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className={`font-semibold text-sm mb-1 ${
                        isActive ? colors.text : isCompleted ? 'text-gray-900' : 'text-gray-500'
                      }`}>
                        {step.title}
                      </h3>
                      {step.description && (
                        <p className="text-xs text-gray-500 mb-2">{step.description}</p>
                      )}
                      {isActive && step.waitingFor && (
                        <p className="text-xs text-gray-600 mt-1">
                          Aguardando {step.waitingFor === 'candidate' ? 'candidato' : 'empresa'}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      {step.date && (
                        <p className="text-xs text-gray-600 mb-1">{formatDate(step.date)}</p>
                      )}
                      {step.timeAgo && (
                        <p className="text-xs text-gray-500">{step.timeAgo}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

