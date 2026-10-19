# Relatório de evolução local — Ministral

**Data:** 22 de agosto de 2026
**Escopo:** evolução visual e funcional exclusivamente no workspace local.
**Restrições preservadas:** logotipo, tipografia Inter, paleta Ministral, permissões, regras de negócio e integrações existentes.

> Esta entrega não foi publicada no Vercel e não houve push para o GitHub.

## Objetivo

Elevar o Ministral para um produto operacional mais consistente em cenários de alta demanda, reduzindo a densidade visual onde necessário, tornando as ações explícitas e protegendo a aplicação contra respostas inválidas da IA. O trabalho manteve a separação entre experiência de usuário, motor local de segurança e serviços externos.

## Melhorias desta rodada

### Membros

Os cards foram reduzidos para uma grade mais densa, com três colunas em telas amplas e espaçamento menor. Todos seguem agora o padrão visual do card de Anderson Alves: avatar fixo, nome e papel no mesmo cabeçalho, funções em área reservada, divisória única, ações administrativas discretas e detalhes de contato/aniversário retraídos inicialmente. Cada card possui controle acessível de expandir/recolher com `aria-label`, indicador visual de rotação e manutenção das ações de editar, promover e remover.

### Relatório de Disponibilidade

A grade foi compactada com quatro colunas em telas extra grandes, padding menor e chips mais densos. Os cards agora têm altura mínima uniforme, cabeçalho estabilizado, área consistente para os dias e observações limitadas a duas linhas. Fotos e fallbacks usam contêiner quadrado fixo, `object-cover`, borda e dimensões mínimas uniformes, evitando que imagens de proporções diferentes alterem a altura ou o alinhamento dos cards.

### IA Avançada

A tela recebeu shell, superfícies, tabs semânticas, botões compartilhados, alvos de toque mínimos, modelo selecionado com `aria-pressed` e estados de loading, erro e orientação inicial. Os handlers de saúde, sugestões, conflitos, avisos e geração de escala agora preservam a mensagem de erro no estado da tela, em vez de depender somente de toast.

As preferências antigas de modelo são migradas para o modelo atual padrão quando o identificador salvo deixou de existir. O conjunto de modelos foi atualizado para identificadores atuais da Gemini: `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-2.5-flash`, `gemini-2.5-pro` e `gemini-3.5-flash-lite`.

### Escala automática no Editor de Escala

O servidor local passou a encaminhar o payload completo ao serviço único de geração e o navegador aceita tanto o array legado quanto o novo retorno estruturado com `assignments`, `source` e `warning`. Isso corrige o problema em que a resposta do servidor era um objeto, mas o cliente esperava array e descartava a geração.

Foi adicionado um validador compartilhado que impede salvar ou revisar sugestões com evento inexistente, função inválida, membro inelegível, indisponibilidade, exclusão de função, duplicidade ou vaga já preenchida. A interface diferencia sugestões realmente geradas pela IA de sugestões calculadas pelo motor local de segurança.

O preenchimento de vagas tenta a IA generativa e usa fallback determinístico quando o serviço externo falha. O reequilíbrio continua intencionalmente determinístico para produzir trocas explicáveis e auditáveis; o modal foi ajustado para não afirmar que esse segundo fluxo é generativo.

Também foram removidos modelos Gemini 2.0 das listas de fallback. A documentação oficial atual registra esses modelos como encerrados em 1º de junho de 2026 e lista os identificadores atuais utilizados nesta rodada.[1] [2]

### SuperAdmin

O shell do SuperAdmin foi alinhado à identidade Ministral, removendo o roxo legado da navegação e adotando azul Ministral, dourado e secundário nos estados ativos, badges, avatar, cabeçalhos e ícones. O menu mobile recebeu rótulos acessíveis e alvos de toque mínimos.

As telas de organizações, comunicados, telemetria, faturamento, usuários, suporte e auditoria receberam superfícies compartilhadas, métricas compactas, filtros com campos globais, tabelas com rolagem horizontal e captions semânticos, estados de carregamento/vazio, ações administrativas com `IconButton` e diferenciação visual consistente entre status e planos.

## Arquivos principais alterados

| Área | Arquivos |
|---|---|
| Membros e cards | `components/MembersScreen.tsx`, `components/AvailabilityReportScreen.tsx` |
| IA e escala automática | `components/AdvancedAIScreen.tsx`, `components/ScheduleEditorV2.tsx`, `services/aiScheduleService.ts`, `services/aiScheduleUtils.ts`, `services/aiOrchestrator.ts`, `server.ts` |
| Rotas de IA | `api/ai/run.ts`, `api/ai/schedule.ts` |
| SuperAdmin | `components/SuperAdminDashboard.tsx`, `components/SuperAdminLayout.tsx` |
| Design system e feedback | `index.css`, `components/ui/FeedbackState.tsx`, `components/ui/index.ts`, `components/Toast.tsx` |
| Testes | `tests/aiScheduleUtils.test.ts` |

Os arquivos em `public/branding/` permaneceram intactos. Nenhum manifesto de pacote foi alterado e nenhuma dependência foi adicionada. O `.env.local` permaneceu fora do versionamento e não foi anexado nem impresso.

## Validação local

| Gate | Resultado | Observação |
|---|---:|---|
| TypeScript | PASS | `tsc --noEmit` sem erros após as alterações de IA e SuperAdmin |
| Lint do projeto | PASS | `npm run lint` concluído |
| Testes | PASS | 5 arquivos e 28 testes aprovados |
| Build de produção | PASS | Vite e service worker gerados corretamente |
| Smoke test da escala | PASS | endpoint retornou array estruturado com atribuição válida |
| Branding/manifests | PASS | sem alterações em `public/branding/` ou manifests |
| Secret scan | PASS | nenhum valor literal de credencial; somente referências esperadas a nomes de variáveis |
| Preview local | PASS | login renderizado com logo, tipografia, paleta e controles principais |

O `git diff --check` passou após a última revisão. O build continua emitindo apenas avisos não bloqueantes sobre chunk minificado grande e configuração de otimização do Vite.

## Limitação ambiental conhecida

A variável `GEMINI_API_KEY` não está configurada no `.env.local` desta sessão. Por isso, o smoke test comprova o contrato do endpoint e o fallback local de segurança, mas não uma chamada real ao provedor Gemini. Para ativar geração generativa real no ambiente local, é necessário configurar a chave apenas no ambiente do servidor, sem expô-la no frontend ou no Git.

A inspeção autenticada das telas internas também depende de uma sessão Supabase válida. O login público foi revisado visualmente; as áreas internas foram validadas por typecheck, testes, build, smoke test e revisão dos fluxos.

## Referências

[1]: https://ai.google.dev/gemini-api/docs/models "Gemini API — Models"
[2]: https://ai.google.dev/gemini-api/docs/deprecations "Gemini API — Deprecations"
[3]: https://ai.google.dev/api/generate-content "Gemini API — Generate content"

## Rodada adicional — fluxo de disponibilidade

A aba de disponibilidade recebeu um fluxo mais rápido para marcação. Dias sem evento continuam alternando diretamente entre disponível e não disponível; dias com um único evento agora também alternam diretamente ao toque, sem abrir modal. Dias com múltiplos eventos abrem o modal detalhado somente quando necessário.

No modal de dia foram adicionadas as ações rápidas **Marcar todos**, **Limpar dia** e **Alternar ciclo geral (D/M/N)**. A seleção individual permanece disponível para ajustes finos, com `aria-pressed`, alvos mínimos de toque e botão de conclusão claro. A confirmação e o salvamento continuam usando o mesmo estado local, merge de datas, notas e persistência já existentes.

Também foram normalizados os rótulos acessíveis do calendário, os indicadores de eventos e as cores auxiliares para tokens Ministral. A validação final passou com typecheck, 28 testes, build de produção e `git diff --check`; não houve alteração em `public/branding/`, manifests, publicação ou push.

## Ajuste adicional — grade de cards

Após a revisão do layout, a grade de Membros foi fixada em três colunas a partir do breakpoint desktop (`lg:grid-cols-3`), com `auto-rows-fr`, `items-stretch`, `h-full` e altura mínima uniforme. O Relatório de Disponibilidade recebeu a mesma regra de três colunas em desktop, com cards de altura mínima uniforme e largura útil maior para nomes, funções, status e dias.

A alteração foi validada localmente com typecheck, 28 testes, build de produção e `git diff --check`. Nenhum arquivo de branding, manifesto ou configuração de publicação foi alterado.

## Ajuste adicional — ações do card de Membros

O botão de expandir/recolher foi retirado do fluxo dos demais controles e passou a ficar fixo na extremidade direita do cabeçalho do card. Os botões administrativos de editar, permissão e remoção permanecem agrupados à esquerda do expansor, com espaçamento reservado para evitar colisão em nomes longos e em telas menores.

O ajuste foi validado com `npx tsc --noEmit`, build de produção local e `git diff --check`. Nenhuma publicação ou alteração de branding foi realizada.

## Ajuste adicional — nomes completos nos cards

O truncamento por reticências foi removido dos nomes nos cards de Membros e no Relatório de Disponibilidade. Os cabeçalhos agora reservam duas linhas, permitem quebra natural de palavras e preservam o expansor à direita e as ações administrativas no lado esquerdo.

A alteração foi validada com `npx tsc --noEmit`, build de produção local e `git diff --check`. Nenhuma publicação ou alteração na identidade visual foi realizada.

## Ajuste adicional — card compacto e informativo de Membros

A composição dos cards foi refeita para mostrar as informações principais de forma compacta: avatar e nome completo no cabeçalho, papel do membro, todas as funções, e-mail, WhatsApp e aniversário. Os detalhes aparecem por padrão para evitar conteúdo escondido, enquanto a seta continua permitindo recolher a área secundária. O expansor permanece fixado à direita e as ações de edição, permissão e remoção formam um grupo compacto entre o conteúdo e o expansor.

A grade continua com três cards por linha no desktop e adaptação para duas ou uma coluna em larguras menores. Typecheck, 28 testes, build local e `git diff --check` passaram após esta rodada.

## Ajuste adicional — estrutura exata do card de Membros

A estrutura do card foi reorganizada conforme a especificação final: no topo ficam `avatar + nome completo + expansor`; na segunda linha ficam `Membro/Admin + editar + promover/remover admin + excluir`; no modo expandido aparecem abaixo as funções e, depois, `e-mail + telefone + data de nascimento`. Ao retrair, funções e dados de contato deixam de ser renderizados, permanecendo apenas o cabeçalho e a linha de papel/ações.

A implementação foi validada com typecheck, build local e `git diff --check`, sem alterar regras administrativas, branding, publicação ou push.

## Ajuste de permissão — Central Operacional

A Central Operacional passou a ser renderizada pelo guard `isAdmin`, baseado em `canManageOrganization(activeUser)`. Assim, somente administradores da organização com escopo válido recebem o painel no Dashboard; membros não veem a Central Operacional e não a acessam por troca direta de aba, pois o guard de navegação permanece sincronizado com as permissões.

A alteração foi validada com typecheck, 28 testes, build local e `git diff --check`. Nenhuma publicação, alteração de branding ou push foi realizado.

## Ajuste de fluxo — Minhas Escalas

A opção de auto-confirmação de presença foi removida da tela Minhas Escalas. O membro continua visualizando seus compromissos, o status de troca e a ação de solicitar troca, mas não pode marcar presença por essa tela. Quando existir registro, ele aparece como **Presença registrada pela liderança**, evitando a interpretação de que a escala equivale a uma confirmação de comparecimento.

O callback de confirmação foi retirado especificamente de `MyScheduleScreen`; o check-in manual administrativo do Editor de Escala permanece separado. Typecheck, 28 testes, build local e `git diff --check` passaram.
