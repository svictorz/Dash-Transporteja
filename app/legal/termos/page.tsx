'use client'

import { motion } from 'framer-motion'
import FadeIn from '@/components/animations/FadeIn'
import { FileText, Scale, AlertCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function TermosUsoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <FadeIn delay={0.1}>
          <Link 
            href="/"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="bg-white rounded-xl shadow-lg p-8 md:p-12">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center">
                <Scale className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                  Termos de Uso
                </h1>
                <p className="text-gray-600 mt-1">Última atualização: Janeiro 2025</p>
              </div>
            </div>

            <div className="prose prose-lg max-w-none">
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-6 h-6 text-green-600" />
                  1. Aceitação dos Termos
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  Ao acessar e usar o sistema TransporteJá, você concorda em cumprir e estar vinculado 
                  a estes Termos de Uso. Se você não concordar com qualquer parte destes termos, 
                  não deve usar nosso serviço.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Descrição do Serviço</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  O TransporteJá é uma plataforma web para gestão de entregas e rastreamento em tempo 
                  real de veículos e motoristas. O serviço inclui:
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                  <li>Registro de check-ins com geolocalização e fotografia</li>
                  <li>Rastreamento de rotas e entregas</li>
                  <li>Gestão de motoristas e veículos</li>
                  <li>Relatórios e análises operacionais</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Cadastro e Conta</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">3.1. Requisitos</h3>
                    <p className="text-gray-700 leading-relaxed">
                      Para usar o serviço, você deve criar uma conta fornecendo informações precisas 
                      e completas. Você é responsável por manter a confidencialidade de suas credenciais.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">3.2. Responsabilidades</h3>
                    <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                      <li>Manter a segurança de sua conta</li>
                      <li>Notificar-nos imediatamente sobre uso não autorizado</li>
                      <li>Ser responsável por todas as atividades em sua conta</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <AlertCircle className="w-6 h-6 text-yellow-600" />
                  4. Uso Aceitável
                </h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Você concorda em NÃO:
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                  <li>Usar o serviço para atividades ilegais</li>
                  <li>Interferir ou interromper o funcionamento do sistema</li>
                  <li>Tentar acessar áreas restritas sem autorização</li>
                  <li>Transmitir vírus, malware ou código malicioso</li>
                  <li>Falsificar informações ou identidade</li>
                  <li>Usar o serviço de forma que viole direitos de terceiros</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Propriedade Intelectual</h2>
                <p className="text-gray-700 leading-relaxed">
                  Todo o conteúdo do TransporteJá, incluindo design, código, textos, gráficos e logotipos, 
                  é propriedade da TransporteJá ou de seus licenciadores e está protegido por leis de 
                  propriedade intelectual.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Dados e Privacidade</h2>
                <p className="text-gray-700 leading-relaxed">
                  O uso de seus dados pessoais é regido por nossa Política de Privacidade, que faz parte 
                  integrante destes Termos de Uso. Ao usar o serviço, você consente com a coleta e uso 
                  de informações conforme descrito na Política de Privacidade.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Limitação de Responsabilidade</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  O TransporteJá é fornecido "como está", sem garantias de qualquer tipo. Não nos 
                  responsabilizamos por:
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                  <li>Interrupções ou indisponibilidade do serviço</li>
                  <li>Perda de dados ou informações</li>
                  <li>Danos indiretos ou consequenciais</li>
                  <li>Decisões tomadas com base em informações do sistema</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Modificações do Serviço</h2>
                <p className="text-gray-700 leading-relaxed">
                  Reservamo-nos o direito de modificar, suspender ou descontinuar qualquer aspecto do 
                  serviço a qualquer momento, com ou sem aviso prévio.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Rescisão</h2>
                <p className="text-gray-700 leading-relaxed">
                  Podemos encerrar ou suspender sua conta e acesso ao serviço imediatamente, sem aviso 
                  prévio, por violação destes Termos de Uso ou por qualquer outro motivo que consideremos 
                  apropriado.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Lei Aplicável</h2>
                <p className="text-gray-700 leading-relaxed">
                  Estes Termos de Uso são regidos pelas leis brasileiras. Qualquer disputa será resolvida 
                  nos tribunais competentes do Brasil.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Contato</h2>
                <p className="text-gray-700 leading-relaxed">
                  Para questões sobre estes Termos de Uso, entre em contato:
                </p>
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-gray-700">
                    <strong>E-mail:</strong> suporte@transporteja.com
                  </p>
                </div>
              </section>
            </div>

            <div className="mt-12 pt-8 border-t border-gray-200">
              <p className="text-sm text-gray-500 text-center">
                Ao usar o TransporteJá, você confirma que leu, entendeu e concorda com estes Termos de Uso.
              </p>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  )
}

