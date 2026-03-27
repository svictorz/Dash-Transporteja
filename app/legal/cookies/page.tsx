'use client'

import { motion } from 'framer-motion'
import FadeIn from '@/components/animations/FadeIn'
import { Cookie, Settings, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function PoliticaCookiesPage() {
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
              <div className="w-16 h-16 bg-orange-100 rounded-xl flex items-center justify-center">
                <Cookie className="w-8 h-8 text-orange-600" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                  Política de Cookies
                </h1>
                <p className="text-gray-600 mt-1">Última atualização: Janeiro 2025</p>
              </div>
            </div>

            <div className="prose prose-lg max-w-none">
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Cookie className="w-6 h-6 text-orange-600" />
                  1. O que são Cookies?
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  Cookies são pequenos arquivos de texto armazenados em seu dispositivo quando você 
                  visita nosso site. Eles nos ajudam a melhorar sua experiência, entender como você 
                  usa nosso serviço e personalizar conteúdo.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Tipos de Cookies que Utilizamos</h2>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">2.1. Cookies Essenciais</h3>
                    <p className="text-gray-700 leading-relaxed">
                      Essenciais para o funcionamento do site. Incluem autenticação, segurança e 
                      preferências básicas. Estes cookies não podem ser desativados.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">2.2. Cookies de Funcionalidade</h3>
                    <p className="text-gray-700 leading-relaxed">
                      Permitem que o site lembre suas escolhas (como idioma ou região) para fornecer 
                      recursos melhorados e personalizados.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">2.3. Cookies de Análise</h3>
                    <p className="text-gray-700 leading-relaxed">
                      Ajudam-nos a entender como os visitantes interagem com o site, coletando informações 
                      de forma anônima. Isso nos permite melhorar o funcionamento do site.
                    </p>
                  </div>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Settings className="w-6 h-6 text-orange-600" />
                  3. Gerenciamento de Cookies
                </h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Você pode controlar e gerenciar cookies de várias formas:
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                  <li>Através das configurações do seu navegador</li>
                  <li>Através da nossa página de configurações de privacidade</li>
                  <li>Através do banner de consentimento quando você visita o site</li>
                </ul>
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <p className="text-gray-700">
                    <strong>Gerenciar preferências:</strong>{' '}
                    <Link href="/dashboard/configuracoes" className="text-blue-600 hover:underline">
                      Ir para Configurações
                    </Link>
                  </p>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Cookies de Terceiros</h2>
                <p className="text-gray-700 leading-relaxed">
                  Alguns cookies podem ser definidos por serviços de terceiros que aparecem em nossas 
                  páginas. Não temos controle sobre esses cookies. Recomendamos verificar os sites de 
                  terceiros para mais informações sobre seus cookies.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Duração dos Cookies</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">5.1. Cookies de Sessão</h3>
                    <p className="text-gray-700 leading-relaxed">
                      Temporários e são excluídos quando você fecha o navegador.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">5.2. Cookies Persistentes</h3>
                    <p className="text-gray-700 leading-relaxed">
                      Permanecem em seu dispositivo por um período determinado ou até que você os exclua.
                    </p>
                  </div>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Consentimento</h2>
                <p className="text-gray-700 leading-relaxed">
                  Ao usar nosso site, você consente com o uso de cookies conforme descrito nesta política. 
                  Você pode retirar seu consentimento a qualquer momento através das configurações do 
                  navegador ou de nossa página de configurações.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Mais Informações</h2>
                <p className="text-gray-700 leading-relaxed">
                  Para mais informações sobre como usamos seus dados, consulte nossa{' '}
                  <Link href="/legal/privacidade" className="text-blue-600 hover:underline">
                    Política de Privacidade
                  </Link>.
                </p>
              </section>
            </div>

            <div className="mt-12 pt-8 border-t border-gray-200">
              <p className="text-sm text-gray-500 text-center">
                Esta política está em conformidade com a Lei Geral de Proteção de Dados (LGPD)
              </p>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  )
}

