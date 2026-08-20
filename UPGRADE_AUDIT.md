# Auditoria inicial do upgrade

## Contexto

Repositório analisado: `Alves1986/ministral`, branch `main`, último commit observado: correção da aba de quotas. O arquivo obrigatório `MINISTRAL.md`, referenciado pelo `AGENTS.MD`, não está presente no repositório.

## Restrições preservadas

- Não alterar os arquivos em `public/branding/`.
- Não alterar as cores existentes do tema Ministral.
- Não alterar o logotipo atual.
- Não adicionar dependências novas.
- Não fazer deploy direto no Vercel.

## Evidências de baseline

- `npm ci --ignore-scripts` não foi possível porque o `package-lock.json` não contém todas as dependências declaradas.
- As dependências declaradas foram instaladas localmente com `npm install --no-package-lock --ignore-scripts --no-audit --no-fund`, sem alteração do lockfile.
- `npm run build` conclui com sucesso, mas informa chunks maiores que 500 kB.
- `npm run lint` falha com dois erros preexistentes observados antes do upgrade: chamada com argumentos em excesso em `App.tsx:1174` e import ausente de `AlertCircle` em `components/SettingsScreen.tsx:474`.
- A execução local renderiza a tela `Falha Crítica de Conexão` porque as variáveis de ambiente do Supabase não estão disponíveis no ambiente de validação.
- O proxy externo do ambiente foi bloqueado pelo `allowedHosts` padrão do Vite; a inspeção direta em `http://localhost:3000` funcionou.

## Design system observado

- Paleta definida em `tailwind.config.js`: azul Ministral `#1E3A5F`, azul escuro `#0D1E33`, fundo claro `#F5F7FC`, dourado `#D6B25E`, teal secundário `#14B8A6` e tema escuro `#0F172A`.
- Fonte declarada: `Inter`.
- O layout principal usa sidebar fixa/colapsável no desktop e bottom navigation no mobile.
- A navegação atual concentra nove itens em `mainNavItems` e até dez itens em `managementNavItems`, com rótulos abreviados como `Ger. Repertório` e `Relat. Disp.`.
- Há repetição de padrões muito arredondados (`rounded-2xl`/`rounded-[2rem]`), sombras grandes e transparência/backdrop blur em navegação e superfícies.
- O cadastro de membros já possui tela própria (`MembersScreen.tsx`), alinhado à diretriz do projeto de organizar membros por função em aba separada.

## Escopo inicial recomendado

1. Refinar o shell de navegação, agrupamento e nomenclatura, mantendo IDs e rotas.
2. Criar tokens semânticos derivados da paleta atual para reduzir repetição e melhorar consistência.
3. Melhorar estados de foco, hover, loading, erro, vazio e responsividade.
4. Reduzir sobreposição visual de sombras, blur e arredondamento sem trocar a identidade.
5. Corrigir os dois erros de TypeScript encontrados no baseline.
6. Validar build, tipos e comportamento observável no navegador sempre que o ambiente de dados permitir.

## Evidência após a primeira implementação

As melhorias de shell e acessibilidade foram aplicadas em `DashboardLayout.tsx` e `index.css`. Os dois erros de TypeScript do baseline também foram corrigidos em `SettingsScreen.tsx` e `App.tsx`.

- `npm run build`: concluído com sucesso; permanece apenas o aviso de chunks maiores que 500 kB.
- `npm run lint`: concluído com sucesso (`tsc --noEmit`).
- A navegação agora possui foco visível global, link para pular ao conteúdo, Escape para fechar menu, semântica de menu no seletor de ministério, tipos explícitos de botão e safe area para a navegação mobile.

## Evidência após o refinamento da visão geral

A tela inicial passou a usar uma hierarquia semântica explícita para o título e para o bloco de ações rápidas. O acesso rápido agora respeita a configuração filtrada de abas (`QUICK_ACTIONS`) em vez de reconstruir a lista diretamente a partir dos itens brutos, e os cards receberam microinterações mais discretas, rótulos acessíveis e botões com tipo explícito.

A validação seguinte também passou: `npm run lint` e `npm run build` concluíram com sucesso. O aviso de chunks grandes permanece como ponto de performance para uma etapa futura de code-splitting, sem relação com o escopo visual desta iteração.

## Evidência visual do fluxo de acesso

Com as variáveis do Supabase disponíveis, a aplicação local carregou a tela de login em `http://localhost:3000/?tab=dashboard`. A tela exibiu o logotipo Ministral, o fundo azul escuro, o destaque dourado e os textos atuais, confirmando que a identidade visual existente permanece intacta. O fluxo observável apresenta campos de e-mail e senha, recuperação de senha, entrada com Google, termos e privacidade.

A navegação autenticada não foi exercitada porque não houve credenciais de usuário fornecidas nem takeover de conta, mas o bundle atualizado foi carregado e o fluxo público de acesso renderizou sem erro de runtime.

## Evidência de teclado

Na tela de login, a navegação por `Tab` permaneceu operacional e os controles interativos continuaram expostos na ordem esperada. A aplicação manteve a composição visual atual, incluindo o logo e o contraste azul/dourado; o destaque de foco global foi adicionado ao CSS para os elementos interativos do shell e das telas.

## Validação de regressão

O projeto não possui um script `test` declarado, mas mantém quatro arquivos de testes executáveis pelo Vitest. A execução de `npx vitest run` passou integralmente: quatro arquivos, 21 testes aprovados. O processo exibiu apenas avisos de configuração/dependência já existentes, sem falhas de teste.

A validação técnica final também passou com `npm run lint`, `npm run build` e `git diff --check`. O build continua emitindo somente o aviso de chunks grandes, que fica registrado como melhoria futura de performance.

## Comunicação agendada

O aviso desta tarefa está ativo como execução única, com o título `Retomar upgrade do Ministral às 08h`, no fuso `America/Sao_Paulo`. O detalhe do aviso solicita apenas o resumo consolidado do andamento, alterações, validações e próximos passos, preservando cores e logotipo.

## Consolidação remota

As alterações foram consolidadas na branch `upgrade/ui-ux-global-2026-08-20` do repositório [Alves1986/ministral](https://github.com/Alves1986/ministral), no commit `99c407b6082a733081676775eeb45627221778d9`. A branch principal não foi alterada e a branch de upgrade está disponível para revisão ou abertura de pull request.

## Etapa de tipografia, botões e first mobile — 20/08/2026

Foi criada uma fundação reutilizável em `components/ui/Button.tsx`, com `Button` e `IconButton`, variantes `primary`, `secondary`, `ghost`, `danger` e `link`, tamanhos com altura mínima de toque, estado de carregamento e labels acessíveis. A tela de login passou a usar essa fundação nos fluxos de entrada, Google, recuperação de senha, visibilidade da senha e documentos legais.

O `DashboardLayout` recebeu `IconButton` nos controles de sincronização e recolhimento do menu, com alvos de toque de pelo menos 40–44px e foco visível. Na `ScheduleTable`, a seleção de membro foi convertida de `div` clicável para `button` com `aria-haspopup` e `aria-expanded`; editar, excluir, fechar seleção e confirmar presença agora têm labels e áreas de toque maiores, além de permanecerem visíveis no mobile.

O CSS global passou a aplicar `font-sans`/Inter ao corpo, `text-rendering: optimizeLegibility`, `touch-action: manipulation`, tokens tipográficos semânticos e estilos consistentes para estados de botão. Cores, logotipo e tokens de marca não foram alterados.

Validação: `npm run build` passou após cada bloco de alterações e na validação final. O build continua emitindo apenas o aviso preexistente de chunk acima de 500 kB (`index` aproximadamente 796 kB minificado), que deve ser tratado em uma etapa específica de code splitting e carregamento sob demanda.


## Inspeção visual mobile da etapa atual

A tentativa de abrir a aplicação local em viewport mobile foi bloqueada antes da tela de login pelo estado `Falha Crítica de Conexão`: o cliente Supabase foi inicializado como `null` por ausência das variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_KEY` no processo Vite. O bloqueio é ambiental e não aponta regressão nos componentes de UI; a validação de build e tipos continua passando. A inspeção visual autenticada deverá ser repetida em ambiente com configuração Vite/Supabase válida.


## Verificação visual e DOM após correção do IconButton

Com o processo Vite configurado, a tela de login renderizou visualmente com o logotipo `/branding/logo-dark.png`, a paleta azul/dourada existente e a tipografia Inter. A medição no DOM confirmou: botão principal com 338 x 48px, botão Google com 338 x 48px e controle de mostrar senha com 44 x 44px. O problema intermediário em que o botão de senha ficava com 18 x 18px foi corrigido ao substituir a classe dinâmica por um mapa de classes literais reconhecido pelo Tailwind.


O `ConfirmationModal` também foi migrado para `Button`, com layout de uma coluna no mobile e duas colunas a partir de telas maiores. As ações de cancelar e confirmar agora usam alturas e estados consistentes com o restante do sistema, sem alteração da lógica ou das cores existentes. `npm run build` passou após essa alteração; permanece somente o aviso de chunk grande já documentado.


## Validação final da etapa tipográfica/mobile

`npm run lint` passou com `tsc --noEmit`. `npx vitest run` passou com 4 arquivos e 21 testes aprovados. `git diff --check` também passou sem apontar whitespace inválido. Os testes exibiram somente avisos já existentes sobre opções deprecated do plugin Vite e a ausência de credenciais Supabase no ambiente de teste; não houve falha funcional.


## Etapa Minha escala e Central de pendências — validação visual

Em 20/08/2026, a instância local foi aberta em `/?tab=my-schedule` em viewport mobile. A aplicação exibiu corretamente a tela pública de login, preservando o logotipo e a identidade visual; a inspeção das telas autenticadas ficou bloqueada pela ausência de sessão autenticada no navegador local, não por erro de runtime do novo código. O console não apresentou exceções; permaneceu apenas o aviso já conhecido de `VITE_VAPID_PUBLIC_KEY` ausente, que afeta somente notificações push.

A validação estrutural passou após a reorganização da barra inferior: `npm run lint`, `npm run build` e `npx vitest run` foram executados; os 4 arquivos e 21 testes existentes passaram. `git diff --check` também passou após a remoção dos espaços residuais. O build continua emitindo apenas o aviso preexistente de chunks maiores que 500 kB.


## Validação final — Minha escala e Central de pendências

A etapa foi validada com `npm run lint`, `npm run build`, `npx vitest run` e `git diff --check`. O lint passou, o build passou, os 4 arquivos de teste e 21 testes passaram, e não há whitespace inválido no diff. Permanecem apenas avisos conhecidos do ecossistema Vite e o aviso de chunks acima de 500 kB; nenhum deles foi introduzido como erro funcional por esta etapa.
