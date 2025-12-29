'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Check, Crown, Truck, ArrowRight, Star } from 'lucide-react'
import FadeIn from '@/components/animations/FadeIn'

interface Plan {
  id: string
  name: string
  description: string
  price: number
  oldPrice?: number
  features: string[]
  popular?: boolean
  routes: number
  drivers: number
  storage: string
}

export default function PlanosPage() {
  const router = useRouter()
  const [selectedPlan, setSelectedPlan] = useState<string>('starter')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [expandedFaq, setExpandedFaq] = useState<{ [key: string]: boolean }>({
    card: false,
    cancel: false
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const user = localStorage.getItem('transporteja-user')
      if (user) {
        setCurrentUser(JSON.parse(user))
      }
    }
  }, [])

  const plans: Plan[] = [
    {
      id: 'starter',
      name: 'Starter',
      description: 'Perfeito para começar',
      price: 149,
      features: [
        '30 links de rastreio/mês',
        'Notificações por email',
        'Foto na coleta e entrega',
        'Suporte por email',
        'Acesso via celular'
      ],
      routes: 30,
      drivers: 0,
      storage: '10GB'
    },
    {
      id: 'profissional',
      name: 'Profissional',
      description: 'Para operações em crescimento',
      price: 499,
      features: [
        '100 links de rastreio/mês',
        'WhatsApp + Email + SMS',
        'Foto na coleta e entrega',
        'Dashboard completo',
        'Suporte prioritário 24/7'
      ],
      popular: true,
      routes: 100,
      drivers: 0,
      storage: '50GB'
    },
    {
      id: 'business',
      name: 'Business',
      description: 'Escala ilimitada',
      price: 1497,
      features: [
        'Links ilimitados',
        'Todos os canais',
        'API completa',
        'White-label',
        'SLA garantido',
        'Gerente de conta dedicado'
      ],
      routes: -1, // Ilimitado
      drivers: -1, // Ilimitado
      storage: '500GB'
    }
  ]

  const handleContinue = () => {
    // Aqui você implementaria a lógica de assinatura
    const selectedPlanData = plans.find(p => p.id === selectedPlan)
    if (selectedPlanData) {
      // Simular salvamento do plano
      const user = localStorage.getItem('transporteja-user')
      if (user) {
        const userData = JSON.parse(user)
        localStorage.setItem('transporteja-user', JSON.stringify({
          ...userData,
          plan: selectedPlanData.name,
          planId: selectedPlanData.id
        }))
      }
      alert(`Plano ${selectedPlanData.name} selecionado! Em breve você receberá instruções para ativação.`)
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 relative overflow-hidden">
      {/* Background Pattern - Textura sutil */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.8) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.8) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
      />

      <div className="relative min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            {/* Coluna Esquerda - Informações */}
            <div className="space-y-8">
              <FadeIn delay={0.1}>
                <div>
                  <h2 className="text-sm font-bold text-orange-500 uppercase tracking-wide mb-2">
                    BEM-VINDO AO TRANSPORTEJA{currentUser?.name ? `, ${currentUser.name.toUpperCase()}!` : '!'}
                  </h2>
                  <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                    Selecione seu plano
                  </h1>
                </div>
              </FadeIn>

              {/* FAQ Section */}
              <FadeIn delay={0.2}>
                <div className="space-y-6">
                  <div>
                    <h3 className="font-bold text-gray-900 mb-2">
                      Como funciona o período de teste?
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      Oferecemos 7 dias de teste gratuito para você explorar todas as funcionalidades do plano escolhido. 
                      Você pode cancelar a qualquer momento durante o período de teste sem nenhum custo. 
                      Não será cobrado nada até o final do período de teste.
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-4">
                      Você pode fazer upgrade, downgrade ou cancelar a qualquer momento com apenas alguns cliques.
                    </p>
                  </div>

                  <div>
                    <button
                      onClick={() => setExpandedFaq(prev => ({ ...prev, card: !prev.card }))}
                      className="w-full text-left"
                    >
                      <h3 className="font-bold text-gray-900 mb-2 flex items-center justify-between">
                        Por que precisamos do cartão de crédito para o teste gratuito?
                        <span className="text-xl text-gray-400">
                          {expandedFaq.card ? '−' : '+'}
                        </span>
                      </h3>
                    </button>
                    {expandedFaq.card && (
                      <p className="text-sm text-gray-600 leading-relaxed mt-2">
                        Solicitamos o cartão de crédito para garantir acesso imediato ao sistema e evitar abusos do período de teste. 
                        Você não será cobrado durante os 7 dias de teste. Se não cancelar antes do término, a assinatura será ativada automaticamente.
                      </p>
                    )}
                  </div>

                  <div>
                    <button
                      onClick={() => setExpandedFaq(prev => ({ ...prev, cancel: !prev.cancel }))}
                      className="w-full text-left"
                    >
                      <h3 className="font-bold text-gray-900 mb-2 flex items-center justify-between">
                        Como cancelo se não estiver satisfeito?
                        <span className="text-xl text-gray-400">
                          {expandedFaq.cancel ? '−' : '+'}
                        </span>
                      </h3>
                    </button>
                    {expandedFaq.cancel && (
                      <p className="text-sm text-gray-600 leading-relaxed mt-2">
                        O cancelamento é simples e pode ser feito a qualquer momento através das configurações da sua conta. 
                        Basta acessar a seção de planos e clicar em "Cancelar assinatura". Você continuará tendo acesso até o final do período pago.
                      </p>
                    )}
                  </div>
                </div>
              </FadeIn>
            </div>

            {/* Coluna Direita - Planos */}
            <div className="space-y-6">
              {plans.map((plan, index) => (
                <FadeIn key={plan.id} delay={0.1 + index * 0.1}>
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    className={`relative bg-white rounded-xl p-5 md:p-6 border-2 cursor-pointer transition-all ${
                      selectedPlan === plan.id
                        ? 'border-orange-500 shadow-lg'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedPlan(plan.id)}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                          MAIS POPULAR
                        </span>
                      </div>
                    )}

                    {plan.id === 'starter' && (
                      <div className="absolute -top-3 left-4">
                        <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                          <Star className="w-3 h-3" />
                          7 dias grátis
                        </span>
                      </div>
                    )}

                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            selectedPlan === plan.id
                              ? 'border-orange-500 bg-orange-500'
                              : 'border-gray-300'
                          }`}>
                            {selectedPlan === plan.id && (
                              <Check className="w-4 h-4 text-white" />
                            )}
                          </div>
                          <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">
                          {plan.description}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-gray-900">
                            R$ {plan.price.toLocaleString('pt-BR')}
                          </span>
                          <span className="text-sm text-gray-500">/mês</span>
                        </div>
                        {plan.oldPrice && (
                          <div className="text-sm text-gray-400 line-through mt-1">
                            R$ {plan.oldPrice.toLocaleString('pt-BR')}/mês
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Features */}
                    <div className="space-y-2 mb-4">
                      {plan.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </FadeIn>
              ))}

              {/* Botão Continuar */}
              <FadeIn delay={0.4}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleContinue}
                  className={`w-full text-white font-bold py-4 px-6 rounded-xl transition-colors shadow-lg flex items-center justify-center gap-2 ${
                    selectedPlan === 'profissional'
                      ? 'bg-blue-500 hover:bg-blue-600'
                      : 'bg-orange-500 hover:bg-orange-600'
                  }`}
                >
                  {selectedPlan === 'starter' ? 'Testar Grátis' : 'Começar Agora'}
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              </FadeIn>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 border-t border-gray-200 mt-12">
          <div className="flex flex-col sm:flex-row items-center justify-between text-sm text-gray-500">
            <div className="flex items-center gap-2 mb-4 sm:mb-0">
              <div className="w-6 h-6 bg-slate-800 rounded flex items-center justify-center">
                <Truck className="w-4 h-4 text-white" />
              </div>
              <span>Copyright © 2024 TransporteJá. Todos os direitos reservados.</span>
            </div>
            <div className="flex items-center gap-4">
              <a href="#" className="hover:text-gray-900 transition-colors">
                Termos de Serviço
              </a>
              <a href="#" className="hover:text-gray-900 transition-colors">
                Política de Privacidade
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

