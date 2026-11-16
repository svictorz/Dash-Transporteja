# Limpeza de imagens Docker autorizada e executada — 08/11/2026

Inventário lido em 08/11/2026. O administrador autorizou explicitamente somente a lista abaixo. Os IDs, contêineres e espaço disponível foram reconfirmados antes da remoção. Não foi usado `system prune`, `volume prune` nem filtro amplo.

## Protegidos

- Em execução: `transporteja:e71b703` (`6c5d0a2c1577`).
- Retorno: `transporteja:e0f5bed` (`908974385e8a`), com contêiner parado `transporteja-previous`.
- Quatro imagens históricas marcadas `pre-*`: `67fbcbd8bb1f`, `274b808aba02`, `685681238688`, `a299a4b0008b`.
- Todas as imagens referenciadas pelos contêineres Supabase, CRM e Traefik. As imagens `public.ecr.aws/supabase/postgres:17.6.1.159`, `postgres:17-alpine` e `alpine:3.20` permanecem até esclarecer sua finalidade.

## Imagens antigas do painel removidas

| Tag `transporteja:` | ID da imagem |
| --- | --- |
| `67fb188` | `c2c721dce6e9` |
| `869832d` | `1d995205785a` |
| `da77e98` | `4d18f0584a73` |
| `6d45bfe` | `62a4a5318f6b` |
| `5e8e6bf` | `de61deccf62d` |
| `13ca636` | `df49bf2c32e8` |
| `1b01940` | `5a7ac903d8c7` |
| `1d1bd4f` | `ed69ed0a9ea1` |
| `9d9b2b6` | `4e67fcc74f1d` |
| `04a9428` | `7cc13c8f920e` |
| `a0d9595` | `6d03d4bc491e` |
| `52ca7ca` | `9c9ca3a3fdae` |
| `0abe400` | `412f5f31b054` |
| `d109ca0` | `b112c943c7b7` |
| `new` | `0aafcfbd6104` |

São 15 IDs não referenciados por contêineres atuais. O tamanho virtual anunciado é aproximadamente 228 MB por imagem, mas as camadas compartilhadas impedem estimar a liberação real pela soma.

## Duas entradas de cache selecionadas, mas não removidas

| ID do cache | Descrição | Último uso | Tamanho informado |
| --- | --- | --- | --- |
| `9gmggzqgzte1tluf5atusd2ey` | `npm ci` | 6 semanas | 954,9 MB |
| `bx8yivo9mwq9p1vodv62hf05t` | `npm ci` | 12 dias | 959 MB |

O Docker marca as duas selecionadas como `Reclaimable=true`, `Shared=false`, mas `docker buildx prune --filter id=<ID>` retornou `Total: 0B` para ambas, inclusive em nova tentativa com `--all`. Uma nova leitura confirmou que os dois IDs continuam presentes entre os 114 registros de cache. **Nenhum cache Docker foi removido.** Não ampliar o filtro sem outra revisão dos candidatos.

## Resultado medido e verificação

- Espaço livre em `/dev/sda1`: 12.265.963.520 bytes antes; 12.702.314.496 bytes depois. Ganho real da remoção das **15 imagens**: **436.350.976 bytes (aproximadamente 416 MiB)**. O ganho é menor que a soma dos tamanhos virtuais porque as imagens compartilham camadas.
- Versão ativa `e71b703` continuou em execução; versão de retorno `e0f5bed` e quatro snapshots `pre-*` continuaram presentes.
- Todos os contêineres Supabase permaneceram saudáveis. Página `/login` da aplicação respondeu HTTP 200; PDF existente respondeu HTTP 200 e `application/pdf`; Postgres aceitou conexões.
- Log da operação: `/home/ubuntu/deploy/backups/prd-20261108/docker-cleanup.log`.
- Nenhum volume, banco ou arquivo do Storage foi removido.
