'use client'

import { motion } from 'framer-motion'
import FadeIn from '@/components/animations/FadeIn'
import { Shield, Lock, Eye, FileText, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function PoliticaPrivacidadePage() {
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
              <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center">
                <Shield className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                  Política de Privacidade
                </h1>
                <p className="text-gray-600 mt-1">Última atualização: Janeiro 2025</p>
              </div>
            </div>

            <div className="prose prose-lg max-w-none">
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Lock className="w-6 h-6 text-blue-600" />
                  1. Introdução
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  A TransporteJá ("nós", "nosso" ou "empresa") está comprometida em proteger a privacidade 
                  e os dados pessoais de nossos usuários. Esta Política de Privacidade descreve como 
                  coletamos, usamos, armazenamos e protegemos suas informações pessoais em conformidade 
                  com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Eye className="w-6 h-6 text-blue-600" />
                  2. Dados Coletados
                </h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">2.1. Dados Fornecidos por Você</h3>
                    <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                      <li>Nome completo</li>
                      <li>Endereço de e-mail</li>
                      <li>Número de telefone</li>
                      <li>CNH (Carteira Nacional de Habilitação)</li>
                      <li>Dados de veículo (placa, modelo)</li>
                      <li>Endereço e localização</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">2.2. Dados Coletados Automaticamente</h3>
                    <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                      <li>Localização GPS (quando autorizado)</li>
                      <li>Fotos de check-in</li>
                      <li>Dados de navegação e uso do sistema</li>
                      <li>Endereço IP e informações do dispositivo</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-6 h-6 text-blue-600" />
                  3. Finalidade do Uso dos Dados
                </h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Utilizamos seus dados pessoais para as seguintes finalidades:
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                  <li>Prestação de serviços de rastreamento e gestão de entregas</li>
                  <li>Registro e validação de check-ins</li>
                  <li>Comunicação com usuários sobre serviços</li>
                  <li>Melhoria da experiência do usuário</li>
                  <li>Cumprimento de obrigações legais</li>
                  <li>Prevenção de fraudes e segurança</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Compartilhamento de Dados</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Não vendemos seus dados pessoais. Podemos compartilhar informações apenas nas seguintes situações:
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                  <li>Com prestadores de serviços que nos auxiliam na operação (sob contrato de confidencialidade)</li>
                  <li>Quando exigido por lei ou ordem judicial</li>
                  <li>Para proteção de direitos e segurança</li>
                  <li>Com seu consentimento explícito</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Segurança dos Dados</h2>
                <p className="text-gray-700 leading-relaxed">
                  Implementamos medidas técnicas e organizacionais adequadas para proteger seus dados pessoais 
                  contra acesso não autorizado, alteração, divulgação ou destruição. Isso inclui criptografia, 
                  controles de acesso e monitoramento regular de segurança.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Seus Direitos (LGPD)</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  De acordo com a LGPD, você tem os seguintes direitos:
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                  <li><strong>Confirmação e acesso:</strong> Saber se tratamos seus dados e acessá-los</li>
                  <li><strong>Correção:</strong> Solicitar correção de dados incompletos ou desatualizados</li>
                  <li><strong>Anonimização, bloqueio ou eliminação:</strong> Solicitar remoção de dados desnecessários</li>
                  <li><strong>Portabilidade:</strong> Receber seus dados em formato estruturado</li>
                  <li><strong>Eliminação:</strong> Solicitar exclusão de dados (direito ao esquecimento)</li>
                  <li><strong>Revogação de consentimento:</strong> Retirar consentimento a qualquer momento</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Retenção de Dados</h2>
                <p className="text-gray-700 leading-relaxed">
                  Mantemos seus dados pessoais apenas pelo tempo necessário para cumprir as finalidades 
                  descritas nesta política, salvo quando a retenção for exigida ou permitida por lei.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Cookies e Tecnologias Similares</h2>
                <p className="text-gray-700 leading-relaxed">
                  Utilizamos cookies e tecnologias similares para melhorar sua experiência. Você pode 
                  gerenciar suas preferências de cookies através das configurações do navegador ou 
                  através da nossa página de configurações.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Alterações nesta Política</h2>
                <p className="text-gray-700 leading-relaxed">
                  Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos você 
                  sobre mudanças significativas através do sistema ou por e-mail.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Contato</h2>
                <p className="text-gray-700 leading-relaxed">
                  Para exercer seus direitos ou esclarecer dúvidas sobre esta política, entre em contato:
                </p>
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-gray-700">
                    <strong>E-mail:</strong> privacidade@transporteja.com<br />
                    <strong>Página de Dados Pessoais:</strong> <Link href="/dashboard/dados-pessoais" className="text-blue-600 hover:underline">/dashboard/dados-pessoais</Link>
                  </p>
                </div>
              </section>
            </div>

            <div className="mt-12 pt-8 border-t border-gray-200">
              <p className="text-sm text-gray-500 text-center">
                Esta política está em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)
              </p>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  )
}

