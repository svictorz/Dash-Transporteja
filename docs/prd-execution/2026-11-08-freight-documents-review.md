# Etapa 2 — anexos compartilhados, revisão antes da publicação

## Alteração preparada

- Rotas e Performance passam a chamar o mesmo serviço para listar, enviar e remover anexos. A galeria visual é um componente compartilhado.
- O bucket `checkin-photos`, os caminhos `documents/<frete>/freteDocs-*`, links públicos, tipos aceitos, limite de PDF (20 MB) e compressão de imagem atual permanecem iguais.
- A listagem percorre páginas de 100 objetos para evitar anexos invisíveis além da primeira página.
- Falha na listagem aparece como erro com opção de tentar novamente; uma resposta antiga não deve substituir os anexos do frete recém-aberto.
- No envio de vários arquivos, cada sucesso aparece imediatamente. Se um arquivo seguinte falhar, os anteriores continuam visíveis, e o input permite selecionar novamente o arquivo pendente.
- O serviço recusa remover um caminho que não pertença ao frete selecionado. As verificações existentes de cargo nas telas e o RLS permanecem inalterados.

## Evidência local

- Testes existentes de cargos, Dashboard e salvamento: passaram.
- Testes do serviço novo: leitura de nome antigo, upload com falha após um sucesso, limite de PDF e limite de caminho: 3/3 passaram.
- `tsc --noEmit`: código 0.
- `next build`: compilação e tipos concluídos com código 0. No Windows, o pacote standalone mostrou aviso de permissão ao criar symlink para o `node_modules` compartilhado; o build normal de contêiner Linux não usa essa junção local.
- Prévia no navegador com imagem e PDF sintéticos: galeria exibida e clique na imagem abriu a visualização ampliada. Nenhum documento real foi enviado.

## Limites desta etapa

- Não muda fórmulas, histórico, metas, cargos, bucket público nem Storage do servidor.
- Não inclui miniaturas ou otimização de PDF; são etapas posteriores e separadas.
- A existência de consumidores externos dos links ainda é incerta. Nenhum caminho ou URL foi alterado por essa razão.
- A verificação de cargos com sessões reais em produção deve ocorrer após publicação controlada; os testes automatizados conferem a matriz existente, mas não substituem todos os fluxos manuais.
