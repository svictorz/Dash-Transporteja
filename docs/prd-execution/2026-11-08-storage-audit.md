# Reconciliação inicial do Storage — somente leitura

Fonte: backup consistente de 08/11/2026, sem excluir ou regravar objetos. O relatório objeto por objeto com caminho, versão física, tamanho, SHA-256 e existência do frete está na cópia local do backup: `C:\Users\Victor\Documents\Codex\2026-10-26\x20-pre\backup-prd-20261108\storage-audit.csv`. O relatório detalhado fica fora do repositório por conter nomes de arquivos e identificadores de fretes.

| Medida | Resultado |
| --- | ---: |
| Objetos em `checkin-photos/documents/` | 1.362 |
| Grupos com SHA-256 repetido | 71 |
| Cópias adicionais idênticas | 76 |
| Bytes das cópias adicionais | 5.962.797 (aprox. 5,69 MiB) |
| Objetos em pastas sem frete atual | 38 |
| Bytes desses objetos | 4.624.238 (aprox. 4,41 MiB) |

O hash compara conteúdo completo extraído do backup, mas **não** demonstra que uma cópia possa ser removida: pode haver vínculos legítimos ou links externos. A ausência do frete atual tampouco autoriza descarte. Como `storage.objects` já registra bucket, caminho, metadados e versão, um novo catálogo de banco não agrega segurança nesta fase. Antes de propor tabela adicional ou deduplicação, é preciso confirmar consumidores externos, responsáveis, política de retenção e como coordenar alterações entre banco e Storage. Os 1.365 objetos originais permanecem preservados.
