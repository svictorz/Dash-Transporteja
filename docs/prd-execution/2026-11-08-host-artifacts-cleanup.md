# Limpeza de artefatos reconstruíveis da VPS — 08/11/2026

O deploy ativo usa `/home/ubuntu/deploy/Dash-Transporteja`, executa `docker build` e instala dependências dentro da imagem. O checkout antigo `/home/ubuntu/transporteja` não tem `.git`; seu serviço systemd está `inactive` e `disabled`. Nenhum processo ou volume Docker ativo usava as pastas abaixo. Os caminhos foram resolvidos e verificados antes da remoção.

| Artefato removido | Natureza | Espaço livre medido após a etapa |
| --- | --- | ---: |
| `/home/ubuntu/transporteja/node_modules` e `.next` | Dependências e build local antigo, reconstruíveis com `npm ci`/`npm run build` | 719.089.664 bytes |
| `/home/ubuntu/.npm/_cacache` | Cache de downloads npm do host, reconstruível | 266.256.384 bytes |

Ganho real desta rodada: **985.346.048 bytes (aprox. 940 MiB)**. O espaço livre passou de cerca de 12,70 GB para 13,69 GB. O código-fonte antigo, `.env`, arquivos de configuração, backups, volumes, banco e Storage ficaram intactos. O serviço systemd antigo, se habilitado manualmente no futuro, exigirá reinstalar dependências e reconstruir `.next`; o deploy atual por Docker é independente dele.

Verificação final: `transporteja:e71b703` permaneceu em execução, `e0f5bed` permaneceu disponível para retorno, todos os contêineres Supabase estavam saudáveis, `/login` respondeu HTTP 200, PDF existente respondeu HTTP 200 como `application/pdf`, contagens de 284 fretes/1.365 objetos/12 usuários preservadas, e os hashes SHA-256 do dump e do arquivo de Storage conferiram.
