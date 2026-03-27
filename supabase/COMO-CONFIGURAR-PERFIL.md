# Como Configurar Perfil de Usuário

## Passo 1: Adicionar Campos na Tabela Users

Execute o script SQL no Supabase SQL Editor:

```sql
-- Execute: supabase/adicionar-campos-perfil.sql
```

Este script adiciona os campos:
- `phone` (TEXT) - Telefone do usuário
- `avatar_url` (TEXT) - URL da foto de perfil

## Passo 2: Criar Bucket de Avatares

1. Acesse o Dashboard do Supabase
2. Vá em **Storage**
3. Clique em **Create bucket**
4. Configure:
   - **Nome:** `avatars`
   - **Public bucket:** ✅ Sim (marcado)
   - **File size limit:** 2 MB (ou o valor desejado)
   - **Allowed MIME types:** `image/jpeg, image/png, image/webp`

## Passo 3: Configurar Políticas do Storage

Execute o script SQL no Supabase SQL Editor:

```sql
-- Execute: supabase/configurar-bucket-avatars.sql
```

Este script cria as políticas de segurança para:
- Usuários podem fazer upload do próprio avatar
- Usuários podem ler avatares
- Usuários podem atualizar o próprio avatar
- Usuários podem deletar o próprio avatar

## Pronto! 🎉

Agora os usuários podem:
- Editar nome e telefone na página de Dados Pessoais
- Fazer upload de foto de perfil
- Recortar a imagem antes de salvar
- A foto será salva no bucket `avatars` do Supabase Storage

## Limites Configurados

- **Tamanho máximo da imagem:** 2 MB
- **Formato de saída:** JPEG (400x400px)
- **Aspect ratio:** 1:1 (quadrado)

