# PRD - Aplicativo Mobile para Motoristas
## TransporteJá - Sistema de Rastreio

**Versão:** 1.0  
**Data:** Janeiro 2025  
**Autor:** Equipe TransporteJá  
**Status:** Em Desenvolvimento

---

## 1. VISÃO GERAL DO PRODUTO

### 1.1 Objetivo
Desenvolver um aplicativo mobile nativo (iOS e Android) que permita aos motoristas realizar check-ins de coleta e entrega, com rastreamento GPS em tempo real, validação de localização e captura de fotos como comprovante.

### 1.2 Público-Alvo
- Motoristas cadastrados no sistema TransporteJá
- Usuários com perfil "driver" no sistema
- Motoristas em rota ativa

### 1.3 Plataformas
- **iOS:** 14.0 ou superior
- **Android:** API 26 (Android 8.0) ou superior

### 1.4 Tecnologias Recomendadas
- **Framework:** React Native ou Flutter
- **Backend:** Supabase (já existente)
- **Autenticação:** Supabase Auth
- **Storage:** Supabase Storage (fotos)
- **Mapas:** Google Maps SDK / Apple Maps
- **GPS:** Geolocation API nativa

---

## 2. FUNCIONALIDADES PRINCIPAIS

### 2.1 Autenticação e Perfil

#### 2.1.1 Login
- **Descrição:** Motorista faz login com email e senha
- **Requisitos:**
  - Integração com Supabase Auth
  - Validação de credenciais
  - Suporte a "Lembrar-me"
  - Recuperação de senha
  - Biometria (Face ID / Touch ID / Fingerprint) - opcional
- **Fluxo:**
  1. Usuário insere email e senha
  2. Sistema valida com Supabase Auth
  3. Se válido, busca dados do motorista na tabela `drivers`
  4. Armazena sessão localmente
  5. Redireciona para tela principal

#### 2.1.2 Perfil do Motorista
- **Informações exibidas:**
  - Nome completo
  - CNH
  - Telefone
  - Email
  - Veículo e placa
  - Status (ativo/inativo/em rota)
- **Ações:**
  - Visualizar dados pessoais
  - Editar informações (se permitido)
  - Alterar senha
  - Logout

---

### 2.2 Dashboard / Tela Principal

#### 2.2.1 Lista de Fretes Atribuídos
- **Descrição:** Exibe todos os fretes atribuídos ao motorista
- **Informações exibidas:**
  - ID do frete (#905645375)
  - Origem e destino
  - Data de coleta prevista
  - Data de entrega prevista
  - Status (Pendente, Em Trânsito, Coletado, Entregue, Cancelado)
  - Veículo atribuído
- **Ações:**
  - Selecionar frete para ver detalhes
  - Filtrar por status
  - Ordenar por data
  - Pull-to-refresh

#### 2.2.2 Card de Frete Ativo
- **Descrição:** Destaque para o frete em andamento
- **Informações:**
  - Status atual (Coleta ou Entrega)
  - Progresso visual (timeline)
  - Distância até destino
  - Tempo estimado de chegada
- **Ações:**
  - Iniciar check-in
  - Ver detalhes completos
  - Abrir navegação (Google Maps / Apple Maps)

---

### 2.3 Detalhes do Frete

#### 2.3.1 Informações da Rota
- **Origem:**
  - Endereço completo
  - Coordenadas GPS
  - Data/hora prevista de coleta
  - Botão "Abrir no mapa"
- **Destino:**
  - Endereço completo
  - Coordenadas GPS
  - Data/hora prevista de entrega
  - Botão "Abrir no mapa"

#### 2.3.2 Timeline de Progresso
- **Etapas:**
  1. Rota criada ✅
  2. Coleta agendada (pendente/ativo/concluído)
  3. Coleta realizada ✅
  4. Em trânsito (ativo/concluído)
  5. Entrega agendada (pendente/ativo/concluído)
  6. Entrega realizada ✅
- **Indicadores visuais:**
  - ✅ Concluído (verde)
  - ⏳ Em andamento (laranja/azul)
  - ⏸️ Pendente (cinza)

#### 2.3.3 Informações do Cliente
- Nome da empresa
- Responsável
- Telefone/WhatsApp
- Endereço completo

---

### 2.4 Check-in de Coleta

#### 2.4.1 Fluxo de Check-in
1. **Validação de Localização:**
   - Sistema obtém GPS atual
   - Calcula distância até local de origem esperado
   - Valida se está dentro do raio permitido (5 km)
   - Se fora do raio, exibe aviso e solicita confirmação

2. **Captura de Foto:**
   - Abre câmera nativa
   - Permite tirar foto da carga
   - Valida tamanho da foto (mínimo 50KB, máximo 5MB)
   - Permite retirar foto se necessário

3. **Geocodificação:**
   - Converte coordenadas GPS em endereço legível
   - Exibe endereço no comprovante

4. **Salvamento:**
   - Upload da foto para Supabase Storage
   - Cria registro na tabela `checkins`
   - Atualiza status da rota
   - Inicia rastreamento contínuo automaticamente

#### 2.4.2 Validações
- ✅ GPS ativo e preciso
- ✅ Foto capturada e válida
- ✅ Localização dentro do raio permitido (ou confirmação do usuário)
- ✅ Motorista autorizado para o frete
- ✅ Sequência correta (não pode fazer entrega sem coleta)

#### 2.4.3 Comprovante
- **Informações exibidas:**
  - Tipo: "Coleta"
  - Data e hora
  - Endereço completo
  - Coordenadas GPS
  - Foto capturada
  - ID do frete
- **Ações:**
  - Baixar PDF do comprovante
  - Compartilhar comprovante
  - Ver no mapa

---

### 2.5 Check-in de Entrega

#### 2.5.1 Fluxo de Check-in
- **Similar ao check-in de coleta, com diferenças:**
  - Valida distância até destino (raio de 2 km)
  - Tipo: "Entrega"
  - Após entrega, finaliza rastreamento contínuo

#### 2.5.2 Validações Especiais
- ✅ Deve ter realizado check-in de coleta primeiro
- ✅ Localização dentro do raio do destino (2 km)
- ✅ Foto da entrega obrigatória

---

### 2.6 Rastreamento Contínuo

#### 2.6.1 Funcionamento
- **Início automático:** Quando motorista faz check-in de coleta
- **Frequência:** A cada 30 segundos
- **Dados capturados:**
  - Coordenadas GPS (lat/lng)
  - Precisão (accuracy)
  - Velocidade (speed)
  - Direção (heading)
  - Timestamp
- **Salvamento:** Tabela `location_updates` no Supabase

#### 2.6.2 Indicadores Visuais
- **Status de rastreamento:**
  - 🔴 Rastreando (com contador de pontos)
  - ⏸️ Pausado
  - ⚠️ Erro (GPS desativado, sem permissão, etc.)

#### 2.6.3 Otimizações
- **Economia de bateria:**
  - Usar GPS de baixa precisão quando veículo parado
  - Pausar rastreamento quando app em background (configurável)
  - Agrupar atualizações quando possível
- **Economia de dados:**
  - Compressão de dados antes de enviar
  - Envio em lote quando offline
  - Cache local

#### 2.6.4 Modo Offline
- Armazenar localizações localmente quando sem internet
- Sincronizar automaticamente quando conexão restaurada
- Indicar status de sincronização

---

### 2.7 Histórico de Check-ins

#### 2.7.1 Lista de Check-ins
- **Filtros:**
  - Por frete
  - Por tipo (coleta/entrega)
  - Por data
- **Informações:**
  - Tipo e data/hora
  - Endereço
  - Foto (thumbnail)
  - Status
- **Ações:**
  - Ver detalhes completos
  - Baixar PDF
  - Compartilhar
  - Ver no mapa

#### 2.7.2 Detalhes do Check-in
- Foto em tamanho completo
- Informações completas
- Mapa com localização
- Opção de baixar/compartilhar PDF

---

### 2.8 Navegação e Mapas

#### 2.8.1 Integração com Apps de Navegação
- **Google Maps:**
  - Abrir rota completa
  - Navegação turn-by-turn
- **Apple Maps (iOS):**
  - Navegação integrada
- **Waze (opcional):**
  - Integração via deep link

#### 2.8.2 Visualização de Rota
- Mapa com origem e destino marcados
- Trajeto completo (quando disponível)
- Localização atual do motorista
- Check-ins marcados no mapa

---

### 2.9 Notificações

#### 2.9.1 Tipos de Notificação
- **Push Notifications:**
  - Novo frete atribuído
  - Lembrete de coleta/entrega
  - Atualizações de status
  - Mensagens do sistema
- **Notificações Locais:**
  - Lembretes de check-in
  - Alerta de GPS desativado
  - Alerta de bateria baixa

#### 2.9.2 Configurações
- Ativar/desativar notificações
- Escolher tipos de notificação
- Horários de silenciar

---

## 3. REQUISITOS TÉCNICOS

### 3.1 Permissões Necessárias

#### iOS
- **Localização (Always):**
  - Descrição: "Precisamos de sua localização para rastrear a rota em tempo real"
  - Uso: Rastreamento contínuo e check-ins
- **Câmera:**
  - Descrição: "Precisamos da câmera para capturar fotos de coleta e entrega"
  - Uso: Check-ins
- **Notificações:**
  - Descrição: "Enviaremos notificações sobre seus fretes"
  - Uso: Push notifications

#### Android
- **Localização (Precisa o tempo todo):**
  - Descrição: "Precisamos de sua localização para rastrear a rota em tempo real"
  - Uso: Rastreamento contínuo e check-ins
- **Câmera:**
  - Descrição: "Precisamos da câmera para capturar fotos de coleta e entrega"
  - Uso: Check-ins
- **Armazenamento:**
  - Descrição: "Para salvar fotos e comprovantes"
  - Uso: Cache de fotos e PDFs
- **Notificações:**
  - Descrição: "Enviaremos notificações sobre seus fretes"
  - Uso: Push notifications

### 3.2 Integrações com Backend

#### 3.2.1 Supabase
- **Autenticação:**
  - Login/logout
  - Recuperação de senha
  - Refresh token
- **Database:**
  - Tabela `drivers` (dados do motorista)
  - Tabela `routes` (rotas/fretes)
  - Tabela `checkins` (check-ins realizados)
  - Tabela `location_updates` (rastreamento contínuo)
- **Storage:**
  - Bucket `checkins` (fotos)
  - Estrutura: `checkins/{user_id}/{timestamp}.jpg`
- **Realtime:**
  - Escutar atualizações de rotas
  - Notificações em tempo real

#### 3.2.2 APIs Externas
- **OpenStreetMap Nominatim:**
  - Geocodificação (endereço → GPS)
  - Geocodificação reversa (GPS → endereço)
  - Rate limit: 1 requisição/segundo
- **Google Maps / Apple Maps:**
  - Navegação
  - Visualização de mapas

### 3.3 Armazenamento Local

#### 3.3.1 Dados a Armazenar
- Sessão do usuário (token)
- Dados do motorista (cache)
- Fretes atribuídos (cache)
- Localizações pendentes (quando offline)
- Configurações do app
- Histórico de check-ins (últimos 50)

#### 3.3.2 Tecnologias
- **iOS:** Core Data ou SQLite
- **Android:** Room Database ou SQLite
- **React Native:** AsyncStorage + SQLite
- **Flutter:** SharedPreferences + SQLite

---

## 4. DESIGN E UX

### 4.1 Princípios de Design
- **Simplicidade:** Interface limpa e intuitiva
- **Acessibilidade:** Suporte a leitores de tela, alto contraste
- **Performance:** Carregamento rápido, animações suaves
- **Confiabilidade:** Feedback claro de ações, tratamento de erros

### 4.2 Paleta de Cores
- **Primária:** Azul (#2563EB) - ações principais
- **Secundária:** Verde (#10B981) - sucesso, entrega
- **Atenção:** Amarelo (#F59E0B) - avisos
- **Erro:** Vermelho (#EF4444) - erros
- **Neutro:** Cinza (#6B7280) - textos secundários

### 4.3 Componentes Principais

#### 4.3.1 Tela de Login
- Logo TransporteJá
- Campos: Email, Senha
- Botão "Entrar"
- Link "Esqueci minha senha"
- Checkbox "Lembrar-me"

#### 4.3.2 Lista de Fretes
- Cards com informações resumidas
- Badge de status colorido
- Swipe para ações rápidas
- Pull-to-refresh

#### 4.3.3 Tela de Check-in
- Botão grande e destacado (Coleta/Entrega)
- Preview da foto antes de confirmar
- Indicador de GPS (precisão)
- Aviso de distância (se aplicável)
- Instruções claras

#### 4.3.4 Comprovante
- Layout tipo recibo
- Foto em destaque
- Informações organizadas
- Botões de ação (PDF, Compartilhar, Mapa)

---

## 5. CASOS DE USO

### 5.1 Caso de Uso 1: Motorista Inicia Dia de Trabalho
1. Motorista abre app
2. Faz login (ou app já está logado)
3. Vê lista de fretes atribuídos
4. Seleciona primeiro frete
5. Visualiza detalhes (origem, destino, horários)
6. Inicia navegação até origem

### 5.2 Caso de Uso 2: Motorista Realiza Coleta
1. Motorista chega no local de origem
2. Abre app e seleciona frete
3. Clica em "Confirmar Coleta"
4. App valida GPS (verifica se está no local correto)
5. Se fora do raio, exibe aviso e solicita confirmação
6. App abre câmera
7. Motorista tira foto da carga
8. App valida foto e faz upload
9. App salva check-in no banco
10. App inicia rastreamento contínuo automaticamente
11. App exibe comprovante
12. Motorista pode baixar PDF ou compartilhar

### 5.3 Caso de Uso 3: Motorista em Trânsito
1. App rastreia localização a cada 30 segundos
2. Localizações são salvas no banco
3. Motorista pode ver progresso no mapa
4. App mostra distância até destino
5. App mostra tempo estimado de chegada

### 5.4 Caso de Uso 4: Motorista Realiza Entrega
1. Motorista chega no destino
2. Abre app e seleciona frete
3. Clica em "Confirmar Entrega"
4. App valida GPS (verifica se está no destino)
5. App abre câmera
6. Motorista tira foto da entrega
7. App valida e salva check-in
8. App finaliza rastreamento contínuo
9. App atualiza status do frete para "Entregue"
10. App exibe comprovante

### 5.5 Caso de Uso 5: Motorista Offline
1. Motorista perde conexão
2. App continua funcionando (modo offline)
3. Localizações são salvas localmente
4. Check-ins são salvos localmente
5. Quando conexão restaurada, app sincroniza automaticamente
6. App exibe notificação de sincronização concluída

---

## 6. VALIDAÇÕES E REGRAS DE NEGÓCIO

### 6.1 Validações de Check-in

#### 6.1.1 Coleta
- ✅ Motorista deve estar autenticado
- ✅ Frete deve estar atribuído ao motorista
- ✅ Status do frete deve ser "pending" ou "inTransit"
- ✅ GPS deve estar ativo e preciso
- ✅ Localização deve estar dentro de 5 km do local de origem (ou confirmação do usuário)
- ✅ Foto deve ser capturada (mínimo 50KB, máximo 5MB)
- ✅ Não pode ter check-in de coleta duplicado para o mesmo frete

#### 6.1.2 Entrega
- ✅ Deve ter check-in de coleta realizado primeiro
- ✅ GPS deve estar ativo e preciso
- ✅ Localização deve estar dentro de 2 km do destino (ou confirmação do usuário)
- ✅ Foto deve ser capturada
- ✅ Não pode ter check-in de entrega duplicado

### 6.2 Validações de Localização
- Coordenadas devem estar no Brasil
- Latitude: -33.75 a 5.27
- Longitude: -74.0 a -32.4
- Precisão mínima: 50 metros (quando possível)

### 6.3 Validações de Foto
- Formato: JPG, PNG ou WEBP
- Tamanho mínimo: 50 KB
- Tamanho máximo: 5 MB
- Dimensões mínimas: 640x480 pixels

---

## 7. TRATAMENTO DE ERROS

### 7.1 Erros Comuns

#### 7.1.1 GPS Desativado
- **Mensagem:** "GPS desativado. Por favor, ative o GPS nas configurações do dispositivo."
- **Ação:** Botão para abrir configurações

#### 7.1.2 Sem Permissão de Localização
- **Mensagem:** "Permissão de localização negada. É necessário para realizar check-ins."
- **Ação:** Botão para abrir configurações

#### 7.1.3 Sem Permissão de Câmera
- **Mensagem:** "Permissão de câmera negada. É necessário para capturar fotos de check-in."
- **Ação:** Botão para abrir configurações

#### 7.1.4 Sem Conexão
- **Mensagem:** "Sem conexão com a internet. Os dados serão sincronizados quando a conexão for restaurada."
- **Ação:** Modo offline ativado automaticamente

#### 7.1.5 Localização Fora do Raio
- **Mensagem:** "Você está a X km do local esperado. Deseja continuar mesmo assim?"
- **Ação:** Botões "Continuar" e "Cancelar"

#### 7.1.6 Erro ao Fazer Upload da Foto
- **Mensagem:** "Erro ao salvar foto. Tente novamente."
- **Ação:** Botão "Tentar Novamente"

#### 7.1.7 Sessão Expirada
- **Mensagem:** "Sua sessão expirou. Por favor, faça login novamente."
- **Ação:** Redirecionamento para tela de login

---

## 8. SEGURANÇA

### 8.1 Autenticação
- Tokens JWT do Supabase
- Refresh automático de tokens
- Logout automático após inatividade (configurável)

### 8.2 Dados Sensíveis
- Armazenamento seguro de tokens (Keychain / Keystore)
- Criptografia de dados locais
- Não armazenar senhas em texto plano

### 8.3 Validações Backend
- Todas as validações críticas devem ser feitas no backend
- Validação de autorização (motorista só pode fazer check-in em seus fretes)
- Validação de coordenadas GPS
- Validação de fotos

---

## 9. PERFORMANCE

### 9.1 Otimizações
- **Imagens:**
  - Compressão antes de upload
  - Thumbnails para listas
  - Cache de imagens
- **GPS:**
  - Uso eficiente de bateria
  - Adaptação de frequência baseada em movimento
- **Rede:**
  - Requisições em lote quando possível
  - Cache de dados frequentes
  - Retry automático em caso de falha

### 9.2 Métricas Alvo
- Tempo de carregamento inicial: < 3 segundos
- Tempo de check-in: < 10 segundos (incluindo upload)
- Uso de bateria: < 5% por hora de rastreamento
- Uso de dados: < 10 MB por dia de uso normal

---

## 10. TESTES

### 10.1 Testes Funcionais
- ✅ Login/logout
- ✅ Listagem de fretes
- ✅ Check-in de coleta
- ✅ Check-in de entrega
- ✅ Rastreamento contínuo
- ✅ Modo offline
- ✅ Sincronização

### 10.2 Testes de Integração
- ✅ Integração com Supabase
- ✅ Upload de fotos
- ✅ Geocodificação
- ✅ Notificações push

### 10.3 Testes de Performance
- ✅ Uso de bateria
- ✅ Uso de dados
- ✅ Tempo de resposta
- ✅ Uso de memória

### 10.4 Testes de Usabilidade
- ✅ Fluxo completo de check-in
- ✅ Navegação entre telas
- ✅ Feedback visual
- ✅ Mensagens de erro

---

## 11. ROADMAP

### 11.1 Fase 1 - MVP (4-6 semanas)
- [ ] Autenticação
- [ ] Listagem de fretes
- [ ] Check-in de coleta
- [ ] Check-in de entrega
- [ ] Upload de fotos
- [ ] Validação básica de localização

### 11.2 Fase 2 - Rastreamento (2-3 semanas)
- [ ] Rastreamento contínuo
- [ ] Visualização de rota no mapa
- [ ] Integração com apps de navegação

### 11.3 Fase 3 - Melhorias (2-3 semanas)
- [ ] Modo offline
- [ ] Histórico de check-ins
- [ ] Notificações push
- [ ] Otimizações de performance

### 11.4 Fase 4 - Polimento (1-2 semanas)
- [ ] Testes completos
- [ ] Ajustes de UX
- [ ] Documentação
- [ ] Preparação para lançamento

---

## 12. MÉTRICAS DE SUCESSO

### 12.1 KPIs
- **Taxa de check-ins completos:** > 95%
- **Tempo médio de check-in:** < 15 segundos
- **Taxa de erro de localização:** < 5%
- **Uptime do rastreamento:** > 98%
- **Satisfação do usuário:** > 4.5/5

### 12.2 Analytics
- Número de check-ins por dia
- Tempo médio de uso do app
- Taxa de retenção de usuários
- Erros mais comuns
- Uso de funcionalidades

---

## 13. DOCUMENTAÇÃO TÉCNICA

### 13.1 APIs Utilizadas
- Supabase Auth API
- Supabase Database API
- Supabase Storage API
- OpenStreetMap Nominatim API

### 13.2 Estrutura de Dados

#### Check-in
```typescript
{
  id: string
  type: 'pickup' | 'delivery'
  timestamp: string
  photo_url: string
  coords_lat: number
  coords_lng: number
  address: string
  distance: number
  freight_id: number
  driver_id: string
  route_id: string
}
```

#### Location Update
```typescript
{
  id: string
  route_id: string
  driver_id: string
  freight_id: number
  coords_lat: number
  coords_lng: number
  accuracy: number
  speed: number
  heading: number
  timestamp: string
}
```

---

## 14. GLOSSÁRIO

- **Check-in:** Registro de coleta ou entrega com foto e GPS
- **Frete:** Carga a ser transportada
- **Rota:** Trajeto de origem a destino
- **Geocodificação:** Conversão de endereço em coordenadas GPS
- **Geocodificação Reversa:** Conversão de coordenadas GPS em endereço
- **Geofencing:** Validação de localização dentro de um raio
- **Rastreamento Contínuo:** Captura periódica de localização GPS

---

## 15. CONTATOS E SUPORTE

- **Equipe de Desenvolvimento:** [A definir]
- **Product Owner:** [A definir]
- **Suporte Técnico:** [A definir]

---

**Fim do Documento**

