# Ministral — Histórico Técnico e de Auditorias

Este documento preserva integralmente o histórico técnico detalhado, auditorias de segurança, rodadas de caçada de bugs e registros arquiteturais do projeto Ministral. Para o índice rápido e estado ativo do projeto, consulte [Ministral.MD](../../Ministral.MD).

---

## Índice do Histórico
1. [Alterações manuais e correções de bugs (Rodadas 1 a 3)](#alterações-manuais-e-correções-de-bugs-rodadas-1-a-3)
2. [Testes de fluxo realizados (Dev + Produção)](#testes-de-fluxo-realizados-dev--produção)
3. [Caçada de bugs — Componentes restantes (Rodada 4)](#caçada-de-bugs-rodada-4--componentes-restantes)
4. [Ajustes de qualidade e correção (Rodada 5)](#ajustes-adicionais-rodada-5--qualidadecorreção)
5. [Ajustes de segurança e UX (Rodada 6)](#ajustes-adicionais-rodada-6--segurança-e-ux)
6. [Auditoria de segurança e vazamento de dados (Rodada 7)](#auditoria-de-segurança--vazamento-de-dados-rodada-7)
7. [Ajustes de layout e responsividade (Rodada 8)](#ajustes-de-layout--responsividade-rodada-8)
8. [Bug de notificações entre dispositivos (Rodada 9)](#bug-de-notificações-entre-dispositivos-rodada-9--diagnóstico-e-fix)
9. [Auditoria da aba IA Avançada (Rodada 10)](#auditoria-da-aba-ia-avançada-rodada-10--advancedaiscreentsx-1148-linhas)
10. [Implementação de Escala por IA Real (Rodada 11)](#implementação-geração-de-escala-por-ia-real-assistente--rodada-11)
11. [Fluxo de Notificações Reais Web Push (Rodada 12)](#fluxo-de-notificações-reais-no-dispositivo-web-push--rodada-12)
12. [Correção Crítica de Notificações Push & PWA (Rodada 13)](#correção-crítica-de-notificações-push--pwa-rodada-13)
13. [Auditoria e Blindagem do Fluxo de Notificações e Edge Functions (Rodada 14)](#auditoria-e-blindagem-do-fluxo-de-notificações-e-edge-functions-rodada-14)
14. [Histórico de Tarefas Concluídas do Backlog](#histórico-de-tarefas-concluídas-do-backlog)
15. [Histórico Legado de Integrações Externas](#histórico-legado-de-integrações-externas)

---

## Alterações manuais e correções de bugs (Rodadas 1 a 3)
> Sessão: análise completa + correções de bugs (2026-08-05).

### Correções aplicadas (validadas: `bun run lint` ✓, `bun run build` ✓, `bun test tests/pickSwapAssignment.test.ts` → 6/6 ✓)
1. **Troca de Escala — vaga errada / falso sucesso** (bug crítico)
   - `services/supabase/misc.ts` — `performSwapSQL` refatorado: extraída função pura `pickSwapAssignment` (desambigua por `event_rules.time` quando há 2+ cultos no mesmo dia/role; nunca mais marca `completed` sem efetivamente trocar — agora lança erro claro).
   - `supabase/functions/whatsapp-webhook/index.ts` (SWAP_ACCEPT) — mesma desambiguação por horário (substituiu `.maybeSingle()` que pegava a 1ª vaga).
   - Novo: `tests/pickSwapAssignment.test.ts` (runner `bun test`, com `// @ts-nocheck` porque o tsc não conhece `bun:test`).
2. **Telemetria zerada** — `components/SuperAdminDashboard.tsx`: removido embed `organization_ministries (label)` que derrubava o SELECT inteiro (tabela sem FK); labels agora em query separada (`ministryLabelMap`).
3. **Segurança** — `server.ts` `/api/spotify/token`: não aceita mais clientSecret do body (só env do servidor).
4. **Estabilidade PWA** — `App.tsx` (InstallBanner): guard no `deferredPrompt.prompt()`.
5. **Segurança (check-in público)** — `supabase/functions/checkin-handler/index.ts`: removido fallback hardcoded de secret HMAC (`"ministral_super_secret_checkin_key_2026"` — qualquer pessoa com acesso ao repo forjava tokens). Agora exige `CHECKIN_SECRET_KEY` configurada no Supabase (sem ela, a função retorna erro claro).

### Migrations novas
- `supabase/migrations/20260630_fix_swap_requests_event_cols.sql` — garante `event_rule_id`/`event_date` em `swap_requests` (webhook insere essas colunas; sem elas o insert falha).
- `supabase/migrations/20260630_fix_whatsapp_usage_logs_fk.sql` — FK `whatsapp_usage_logs.ministry_id → organization_ministries(id)` (resolve de vez a telemetria).

### Observações da análise
- `tsconfig.json` exclui `supabase/` do typecheck — Edge Functions nunca são validadas por `bun run lint`. Sugestão: `deno check` no CI.
- Google Agenda "botão sem resposta": código dos handlers OK; causa provável é config de OAuth/redirect (URLs autorizadas) ou `provider_token` ausente — precisa diagnóstico em runtime.
- Testes vitest quebrados: falta `@testing-library/dom` (dep do `@testing-library/jest-dom` v6) — pendente aprovação para instalar.
- `bun.lockb` criado pelo `bun install` (lockfile do bun) — incluir no commit.
- **`push-notification` usa schema legado**: actions `delete_member`/`toggle_admin` acessavam `events` e `schedule_assignments.event_id` — colunas/tabelas que não existem no app atual (rules + event_date). Pode falhar com "column not found". Revisar ou remover esses actions.
- Versão do Deno std inconsistente entre functions (0.168.0 vs 0.177.0) — padronizar.
- `ProfileScreen` filtra `__dance_count:` das funções, mas `fetchMinistryMembers` (misc.ts) só filtra `__vocal_count:` — inconsistência menor.
- **`CHECKIN_SECRET_KEY` precisa ser configurada no Supabase** (secret das Edge Functions) para o check-in voltar a funcionar após o fix de segurança.
- Itens do MINISTRAL.md já resolvidos (backlog desatualizado): `isSyncing` na AvailabilityScreen já implementado; `onSwitchMinistry` já paralelizado com `Promise.all`; não há Realtime de disponibilidade no frontend (não existe race condition).
- **`fetchNextEventTeam` (scheduleServiceV2.ts) é código morto com bug**: mapeia `m.id`/`m.name` mas `fetchNextEventCardData` retorna `memberId`/`name` → `memberId: undefined`. Não usado em lugar nenhum hoje — corrigir ou remover.
- **Endpoint IA público**: `api/ai/run.ts` (Vercel) não tem auth/rate-limit — qualquer pessoa pode gastar a quota Gemini. Considerar restringir por origem ou exigir JWT do app.
- **Duplicação arquitetural IA**: `services/aiOrchestrator.ts` usa o SDK @google/genai (via server.ts no dev) enquanto `api/ai/run.ts` usa REST direto (produção Vercel). Implementações divergentes — comportamento pode diferir entre dev e prod.
- **MembersScreen**: rótulo de debug "(Debug: Not Admin)" vazava para membros comuns na aba Auditoria — REMOVIDO nesta sessão.
- **EventsScreen:40**: `return` condicional antes do `useEffect` (linha 58) viola regras de hooks (porém o guard raramente dispara no fluxo normal, pois a aba só renderiza com ministryId válido). Risco baixo.
- **EventsScreen:24**: `filterMonth` inicial usa `toISOString()` (UTC) — pode mostrar mês errado perto da virada de mês. Menor.
- **`alert()` → Toast** (migração UX nesta sessão): `JoinMinistryModal`, `ManagementModals` (EditMemberModal), `PlanScreen`. Restam `window.confirm()` intencionais (confirmação destrutiva) em AvailabilityScreen, ScheduleEditorV2, MembersScreen, GoogleCalendarSettings, SuperAdminDashboard — funcional.
- **CifraClub/Vagalume CORRIGIDO (bug achado em teste de fluxo)**: pacote `vagalume@1.0.3` quebrava em runtime (`"Vagalume is not a constructor"` — imports sem extensão `core-js/library/es6/promise`). `services/cifraClubService.ts` reescrito com REST direto (`api.vagalume.com.br/search.artmus` e `/search.php`). Obs: a API externa do Vagalume retornou 503 no momento do teste (indisponível/bloqueio) — pode exigir apikey para confiabilidade.
- **Testes de lógica**: criado `vitest.config.lite.ts` (environment node, sem o setup que importa jest-dom) para rodar testes puros sem `@testing-library/dom`. Testes: `pickSwapAssignment.test.ts` (6), `scheduleLogic.test.ts` (7: generateOccurrencesV2, dateUtils), `deleteGlobalUser.test.ts` (1) → **14/14 verdes** com `npx vitest run --config vitest.config.lite.ts`.

---

## Testes de fluxo realizados (Dev + Produção)
- API Express (dev): `/api/health` 200; `/` 200; `/api/spotify/config` `{clientId:""}`; `/api/spotify/token` POST com secret no body → `{error:"Spotify credentials not configured"}` (confirma que o body foi ignorado); `/api/weather` sem params → erro correto; `/api/weather?lat=-24.33&lon=-50.84` → `{temperature:16.5, city:"Ortigueira"}` (fetch externo OK); `/api/cifraclub/search` → parou de crashar (retorna `[]`; API externa Vagalume 503 no momento); `/api/youtube/search` → `[]` (sem YT key); `/api/ai/run` POST → erro claro `GEMINI_API_KEY não configurada` (comportamento correto sem env).
- Bundle produção (`vite preview --port 4173`): `/` 200 text/html; `/manifest.json` 200 app/json; `/sw.js` 200 text/javascript; asset CSS 200; deep link `/?tab=swaps` 200 → PWA servindo corretamente.
- Testes unitários: 14/14 verdes.
- **NÃO testado (exige ambiente real)**: Supabase (login/RLS/swap e2e/telemetria real), Google OAuth (Agenda), Evolution/WhatsApp (instância), render/cliques de UI (sem browser toolset), YouTube + Gemini (sem chaves nos env).

---

## Caçada de bugs (Rodada 4) — Componentes restantes
- Revisados: NextEventCard, BirthdayCard, HistoryScreen, RankingScreen, Toast, AnnouncementCard, ManagementModals, RichTextEditor, links externos. **Nenhum bug novo crítico**.
- `dangerouslySetInnerHTML` (AnnouncementCard:192, AlertsManager:300) já usa `DOMPurify.sanitize` — OK (não é XSS).
- `target="_blank"` em links externos já possuem `rel` (checado por leitura multilinha — falso positivo do scan de 1 linha). Sem tabnabbing.
- `RichTextEditor` manipula `innerHTML` cru (contenteditable) sem sanitize local, mas o conteúdo renderizado é sanitizado via DOMPurify no AnnouncementCard — risco mitigado (observação).

---

## Ajustes adicionais (Rodada 5 — Qualidade/Correção)
1. **EventsScreen**: `return` condicional movido para DEPOIS do `useEffect` (corrige violação de regras de hooks — o número de hooks diferia entre renders com/sem ministryId). Filtro de mês inicial agora usa `getLocalDateISOString()` em vez de `toISOString()` (UTC).
2. **`fetchNextEventTeam`** (scheduleServiceV2.ts): corrigido mapeamento `m.id`→`m.memberId` (era `undefined`) — código morto, mas agora correto se usado.
3. **Filtro de contagem**: `misc.ts` e `scheduleServiceV2.ts` agora filtram `__vocal_count:` E `__dance_count:` (estava só `__vocal_count:`) ao limpar funções dos membros — consistente com os componentes (Profile/Members/Roles).
4. **Deno std padronizado**: 5 edge functions (stripe-webhook, stripe-create-checkout, stripe-customer-portal, accept-invite, validate-invite) atualizadas de `std@0.168.0` → `std@0.177.0`.
5. **notifications.ts**: `catch(() => {})` agora registra warning (push super-admin falho não fica mais invisível).
6. **typo**: `"Issa ação"` → `"Essa ação"` no GoogleCalendarSettings (janela de confirmação de sync).

---

## Ajustes adicionais (Rodada 6 — Segurança e UX)
1. **push-notification**: removidos actions legados `delete_member`/`toggle_admin` (usavam schema inexistente — `events` e `schedule_assignments.event_id`; o app usa `deleteMember`/`toggleAdminSQL` com RLS). Mantido o fluxo principal de push + `generate_keys`.
2. **Segurança endpoint IA**: `api/ai/run.ts` agora exige JWT válido do Supabase (valida com `auth.getUser`); `runAI` (browser) anexa `Authorization: Bearer <JWT>` ao chamar. Protege contra abuso/queima da quota Gemini. (Sem chaves no Vercel, o endpoint retorna 401 claro.) O `server.ts` dev (localhost) não exige auth — aceitável em ambiente de desenvolvimento.
3. **UX: `window.confirm` → `confirmAction`** (modal próprio do app, melhor no PWA) em: MembersScreen (tornar/remover admin), AvailabilityScreen (2x: navegação de mês + troca de membro, com reestruturação), GoogleCalendarSettings (sync em massa, extraído `runSync`), ScheduleEditorV2 (excluir evento), SuperAdminDashboard (2x: remover de ministério + remover usuário permanentemente).

---

## Auditoria de segurança / vazamento de dados (Rodada 7)
- **[CRÍTICO — CORRIGIDO] RLS de `support_tickets`**: as policies usavam apenas `auth.uid() is not null` (sem filtro de `organization_id`) — QUALQUER usuário autenticado de QUALQUER org podia ler/CRIAR/EDITAR/DELETAR tickets de suporte de todas as organizações (violação multi-tenant, pode conter PII/prints da igreja). Criada migration `supabase/migrations/20260630_fix_support_tickets_rls.sql` que isola por org (SELECT: mesma org ou super admin; INSERT: própria org; UPDATE/DELETE: admin da própria org ou super admin).
- **[MÉDIA] `spotify_refresh_token` em localStorage** (spotifyService.ts) — token de longa duração persistido; se houver XSS, é exfiltrado. Uso comum em apps client-side, mas é um risco residual (anotado).
- **[BAIXA] Token de convite na URL** (`?invite=...`) — pode vazar em logs de servidor/histórico/referrer; atenuado pois `invite_tokens` tem `expires_at` (validado em accept-invite/validate-invite).
- **[BAIXA] `console.log` de payload do perfil** no SessionContext (Realtime profile update) — REMOVIDOS nesta sessão (indentação normalizada).
- **[OK] PDF**: exportação (ToolsMenu) só acessível a admins (aparece apenas no `schedule-editor`, que exige `isAdmin`); conteúdo tem só NOMES (sem email/whatsapp/birthDate).
- **[OK] `push_subscriptions`**: RLS `auth.uid() = user_id` (dados próprios).
- **[OK] Rotas/abas admin**: `members`, `event-rules`, `schedule-rules`, `plan`, `support-admin`, `advanced-ai`, `report`, `monthly-report`, `schedule-editor`, `super-admin` — todas com guard `isAdmin`/`isSuperAdmin` no App.tsx.
- **[OK] `fetchMinistryMembers`**: filtra PII (email/whatsapp/birthDate) por `canSeePII` (requester admin ou self).

---

## Ajustes de layout / responsividade (Rodada 8)
1. **[CRÍTICO de layout] Escala de cores `ministral` incompleta**: os tons `200, 300, 400, 700, 800, 900` NÃO existiam no `tailwind.config.js`, mas eram usados em dezenas de componentes (14 arq. usam `ministral-400`, 13 usam `ministral-900`...). O Tailwind não gerava essas classes → fundos/textos/bordas INVISÍVEIS. Completada a escala navy no config (50 a 900 + gold/dark/text/muted). Confirmado que o CSS gerado agora contém as novas cores.
2. **Responsividade mobile — grids fixos**: corrigidos para quebrar em 1 coluna no mobile (antes espremiam ao lado):
   - `RegisterOrganizationScreen` (senha/confirmar): `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`
   - `EventDetailsModal` (data/horário): `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`
   - `MonthlyReportScreen` (stats escalas): `grid-cols-3` → `grid-cols-1 sm:grid-cols-3`
   - `AlertsManager` (tipos de alerta): `grid-cols-4` → `grid-cols-2 sm:grid-cols-4`
3. **Verificado (falso positivo)**: as tabelas largas do `ScheduleEditorV2` (wrapper `overflow-auto`) e `AdvancedAIScreen` (`overflow-x-auto`) JÁ estão protegidas do scroll horizontal — não quebram mobile.

---

## Bug de notificações entre dispositivos (Rodada 9) — DIAGNÓSTICO E FIX
- **Sintoma**: ao limpar notificações num dispositivo e entrar por outro, elas "voltam".
- **Causa raiz**: `markNotificationsReadSQL` / `clearNotificationsSQL` persistem via `upsert(...)` com `onConflict: 'user_id, notification_id'` nas tabelas `notification_reads` e `notification_clears`. Isso EXIGE constraint `UNIQUE(user_id, notification_id)` nessas tabelas — e nenhuma migration do repo criava essas tabelas. Sem a constraint (ou sem a tabela), o upsert falha silenciosamente e a limpeza fica apenas no `localStorage` do dispositivo → outro dispositivo busca `notification_clears` vazio e as notificações reaparecem.
- **Fix**: migration `supabase/migrations/20260630_fix_notification_clears.sql` — cria `notification_reads` e `notification_clears` (idempotente) com constraint UNIQUE + RLS por usuário (`auth.uid() = user_id`) + índices; se as tabelas já existirem sem a constraint, adiciona via DO $$.
- **Código defensivo**: `markNotificationsReadSQL` agora tem try/catch (evita erro não tratado na UI se o banco falhar; a UI já aplica optimistic update).

---

## Auditoria da aba IA Avançada (Rodada 10) — AdvancedAIScreen.tsx (1148 linhas)
- **[CORRIGIDO] Classes Tailwind inválidas**: `amber-955`/`green-955` (typos, não existem) quebravam o fundo no dark mode (avisos de conflito e selos "sem conflitos"). Corrigidos para `amber-950`/`green-950`.
- **[CORRIGIDO] `healthInsights.score` sem guarda**: se a IA não retornar JSON no formato esperado, o círculo exibia "undefined"/quebra. Agora com fallback (`--`) e classes com score nulo.
- **[OBSERVAÇÃO] "Gerador Inteligente" não usa IA de verdade**: `handleGenerateProposal` → `generateAISchedule` → `generateScheduleWithAI` → `generateScheduleLocally` (heurística local). O `selectedModel` é ignorado na geração de escala (a UI promete "IA", mas roda algoritmo local p/ economizar tokens). Por intenção, mas a comunicação ao usuário é imprecisa.
- **[OBSERVAÇÃO] `getReducedPayload`**: trata `availability` como `{membro: {data: status}}`, mas o payload recebido é `availabilityByName` (`{nome: string[]}`) — o payload enviado à IA fica distorcido (degrada a qualidade da análise, não crash).
- **[OBSERVAÇÃO] `active_members` conta todos**: filtra por `m.status !== 'inactive'`, mas o tipo de membro não tem `status` — todos contam como ativos no contexto da IA.
- **[OK] Acesso**: aba exige `isAdmin && isPro` no App.tsx. `runAI` agora envia JWT (endpoint autenticado). Abas: Saúde, Análise Preditiva, Detectar Conflitos, Gerador Inteligente, Avisos, Configuração. Tratamento de erro com toast em todos os handlers; loading states por aba.

---

## Implementação: Geração de Escala por IA REAL (assistente) — Rodada 11
**Objetivo:** a IA deve atuar como assistente do ministério — entender quem são os membros, suas funções, datas disponíveis e regras de escala, e gerar as escalas automaticamente.
- **ANTES**: `generateScheduleWithAI` e o endpoint `/api/ai/schedule` só rodavam heurística local (`generateScheduleLocally`) — a UI prometia "IA", mas nunca chamava o Gemini para preencher a escala.
- **AGORA**:
  1. Novo `services/aiScheduleUtils.ts` — `buildSchedulePrompt(input)` monta um prompt estruturado com: eventos do mês, funções, membros (nome+id+funções), disponibilidade (normaliza array ou objeto de datas), escalas já preenchidas e regras de conflito (grupos de bloqueio, exceções, bloqueio/preferência entre membros, exclusões por evento). `extractAssignments(text)` parseia a resposta (JSON puro, markdown, ou wrapper `{assignments}`) e filtra itens inválidos.
  2. `aiOrchestrator.generateScheduleWithAI(data, model)` agora TENTA a IA real (Gemini via `callWithFallback`, com `responseMimeType=json`) e só cai no algoritmo local se a IA falhar (chave/rede/quota) ou retornar 0 atribuições. `rebalance` continua local (determinístico).
  3. `api/ai/schedule.ts` (Vercel) reescrito: autentica com JWT do Supabase, monta o prompt (importando do utils), chama Gemini REST (fallback entre modelos), parseia e retorna as atribuições. `mode=rebalance` retorna [] (fica no cliente).
  4. `aiScheduleService.generateAISchedule` (cliente): no navegador faz `fetch('/api/ai/schedule')` com JWT; se falhar, cai em `generateScheduleLocally`; `rebalance` nunca passa pela API.
- **Efeito**: o Editor de Escala e o Gerador Inteligente agora usam a IA para preencher vagas (respeitando disponibilidade e regras), com fallback automático.
- **Testes**: +7 testes (buildSchedulePrompt/extractAssignments) → **21/21 verdes**.
- **PARA FUNCIONAR EM PRODUÇÃO**: `GEMINI_API_KEY` + `SUPABASE_URL`/`SUPABASE_ANON_KEY` (ou `VITE_SUPABASE_URL`/`VITE_SUPABASE_KEY`) configurados no Vercel. Sem chave, cai no fallback local (o app não quebra).

---

## Fluxo de Notificações REAIS no dispositivo (Web Push) — Rodada 12
- **[BUG PRINCIPAL CORRIGIDO] Service worker sem handler de push**: o `vite-plugin-pwa` usava `generateSW`, que gerava um SW do ZERO SEM o listener `push` — as notificações chegavam ao dispositivo mas NUNCA eram exibidas. Migrado para `injectManifest` (usa `src/sw.js` como base + injeta precache). Confirmado: `dist/sw.js` agora contém `showNotification` + `addEventListener('push')`. Removida a `tag` fixa (cada notificação substituía a anterior).
- **[CORRIGIDO] Super admin não recebia push**: `notifySuperAdmins` só criava notificação INTERNA. Agora também invoca `push-notification` com `userIds` dos admins (envio direcionado). Isso cobre: pedido de troca, solicitação de entrada, novo integrante, novo ministério, solicitação de função ministro, etc.
- **[CORRIGIDO] `push-notification` sem envio direcionado**: edge function agora aceita `userIds`/`userId` no body (envio só para os alvos), com validação de privilégio (admin/super admin podem notificar admins de outras orgs; membro comum só dentro do ministério).
- **[NOVO] `push-reminders` (edge function + cron)**: lembrete automático do DIA DA ESCALA (membros escalados hoje recebem push com evento+horário) e JANELA DE DISPONIBILIDADE (abre/fecha automaticamente na data configurada). Deduplicação via tabela `push_reminder_log` (migration nova).
- **Já existia e funciona**: avisos internos (App/Repertoire → `sendNotificationSQL` → push) e abertura/encerramento manual da janela no Settings.
- **Configuração necessária**:
  1. Supabase (Edge Functions secrets): `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` (mesmo par), `WHATSAPP_CRON_SECRET` (para o cron).
  2. Vercel: `VITE_VAPID_PUBLIC_KEY` = a MESMA pública do par VAPID (o cliente assina a subscrição com ela).
  3. Supabase: aplicar migration `20260630_push_reminder_log.sql` + criar o cron diário chamando `push-reminders` com header `x-cron-secret` (ex: `0 8 * * *`).

---

## Correção Crítica de Notificações Push & PWA (Rodada 13)
- **Sintoma**: O sistema não notificava no WebApp instalado no PC nem no mobile (apenas teste direto na página web aberta no navegador).
- **Causa Raiz & Resolução**:
  1. **Crash de sintaxe no SW**: Em `public/sw.js`, havia a atribuição `self.__WB_MANIFEST = [];`. Ao rodar `vite build` com Workbox `injectManifest`, a injeção substituía `self.__WB_MANIFEST` pelo array de precache, transformando a linha em `[{...}] = [];` (alvo inválido de destructuring assignment em JS), provocando SyntaxError imediato ao avaliar o Service Worker. Resolvido com declaração de constante limpa `const swManifest = self.__WB_MANIFEST; self.__SW_MANIFEST = swManifest;`.
  2. **Entrega de Notificação no SO Mobile/Desktop**: Adicionados `tag` único por notificação e `renotify: true` nas opções de `showNotification`, além de fallbacks de ícones, garantindo que o Android e o Windows não silenciem ou descartem novas notificações.
  3. **Erro 400 na busca de notificações**: `fetchNotificationsSQL` montava `ministry_id.in.(null)` quando a lista de ministérios vinha vazia e quebrava caso a relação de FK com `organization_ministries` estivesse ausente. Adicionada higienização de filtros e fallback resiliente automático para `select('*')`.
  4. **Meta tag PWA**: Adicionada `<meta name="mobile-web-app-capable" content="yes" />` no `index.html`.

---

## Auditoria e Blindagem do Fluxo de Notificações e Edge Functions (Rodada 14)
- **Sintoma**: Ao enviar um aviso na interface, o sistema gerava alerta de falha de envio de notificação (`"Aviso publicado, mas houve falha ao disparar as notificações Push/WhatsApp."`) e falhava a entrega externa no PWA/Mobile.
- **Causa Raiz Identificada**:
  1. `sendNotificationSQL` inseria `target_user_id: null` para comunicados coletivos. Na ausência da coluna no banco, o PostgREST gerava erro `42703`. O fallback removia apenas `action_link` e relançava a exceção, acionando o toast de aviso.
  2. A Edge Function `push-notification` tinha `ALLOWED_ORIGIN` estático apontando para `https://seu-dominio.com`, gerando erro de CORS nas requisições do frontend.
  3. A verificação de permissão da Edge Function não checava administradores da tabela `ministry_members` e ignorava `is_super_admin`, retornando `403 Forbidden`.
  4. A busca de destinatários no envio para ministérios consultava apenas a tabela `profiles`, excluindo membros vinculados pela tabela canônica `ministry_members`.
  5. A subscrição push do dispositivo não era sincronizada ao carregar a sessão autenticada, fazendo com que o banco não tivesse o endpoint gravado.
- **Correções Aplicadas**:
  1. `services/supabase/notifications.ts`: payload saneado (só inclui `target_user_id` e `action_link` quando fornecidos); fallback completo em camadas que recupera com schema base (`organization_id`, `ministry_id`, `title`, `message`, `type`) sem lançar exceções bloqueantes para operações secundárias.
  2. `supabase/functions/push-notification/index.ts`: CORS liberado para `*`; inclusão de `is_super_admin` e verificação de admin/líder via `ministry_members`; busca unificada de destinatários em `ministry_members` e `profiles`.
  3. `utils/pushUtils.ts` & `App.tsx`: verificação e renovação de chaves VAPID incompatíveis; auto-sincronização da inscrição no Supabase no momento em que a sessão do usuário é carregada.
  4. `public/sw.js`: extração inteligente do parâmetro `tab` da URL de ação para deep-link instantâneo ao clicar na notificação push.
  5. Mensagem obsoleta com menção a "WhatsApp" substituída por confirmação de sucesso limpa.

---

## Histórico de Tarefas Concluídas do Backlog
- [x] **[FEAT]** Login via Google restrito — apenas membros já cadastrados podem logar; novos usuários recebem erro amigável.
- [x] **[FEAT]** Web Push Notifications — service worker, banner de permissão, edge function `push-notification`, tabela `push_subscriptions` com RLS.
- [x] **[BUG]** Corrigir bloqueio de cadastro de membros via convite com Google OAuth (preservar token, permitir signup e vincular à organização).
- [x] **[FEAT]** Logs de Auditoria para administradores, registrando ações importantes do ministério.
- [x] **[FEAT]** Gestão Autônoma de Ministérios por OrgAdmins na interface de Configurações, aplicando limites de planos com RPC segura.
- [x] **[FEAT]** Inversão da lógica de disponibilidade de membros (marcação de indisponibilidade).
- [x] **[FEAT]** Correção da política de RLS em logs de auditoria permitindo visibilidade ampla para administradores da mesma organização.
- [x] **[FEAT]** Bloqueio de cadastro de eventos para evitar conflitos de horários em regras simultâneas.
- [x] **[REFACTOR]** Simplificação da aba de Repertório (foco exclusivo em YouTube).
- [x] **[FEAT]** Sistema de Chat da Equipe para membros escalados em eventos (suporte a áudio e texto).
- [x] **[BUG]** Corrigir erro no fluxo da Troca de Escala — resolvido com desambiguação por horário e proteção contra falsa conclusão (`pickSwapAssignment`).
- [x] **[BUG]** Corrigir sistema de telemetria zerado — removido embed com tabela sem FK (`SuperAdminDashboard`).
- [x] **[FEAT]** Notificações de swap aprovado / solicitado — avisos em tempo real via in-app e Web Push.
- [x] **[BUG]** Race condition de disponibilidade — já implementado com `isSyncing` e sem listener Realtime conflitante.
- [x] **[PERF]** Ministry-switching lento — otimizado com paralelização de chamadas em `SessionContext.tsx`.
- [x] **[BUG]** Alerta de falha no envio de avisos e notificações push — corrigido fallback de schema, CORS da edge function e resolução de membros.

---

## Histórico Legado de Integrações Externas
> **Nota de Descontinuação**: A integração nativa com o WhatsApp via Evolution API foi descontinuada e removida do código principal em 19/08/2026 (Commit `f39c48b`), transferindo a comunicação ativa inteiramente para Web Push Notifications (PWA/Browser) e notificações in-app.
- Antigos módulos descontinuados: `whatsapp-reminders`, `whatsapp-webhook`, `whatsapp-connect`, `whatsapp-disconnect`, `whatsapp-status`, `whatsapp-swap-notify`.
- As tabelas e migrações relacionadas a logs de uso de WhatsApp permanecem apenas para integridade histórica de telemetria passada.
