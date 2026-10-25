# Ministral — Guia e Índice do Projeto

> **Histórico Completo**: O histórico técnico detalhado, rodadas de auditoria, caçadas de bugs e registros das sessões anteriores estão preservados integralmente em [MINISTRAL_HISTORY.md](docs/agent-context/MINISTRAL_HISTORY.md).
> **Regras do Agente**: Diretrizes operacionais e ciclo de trabalho do agente estão em [AGENTS.MD](AGENTS.MD).

---

## 1. Identidade do Projeto
- **Definição**: SaaS multi-tenant de gestão de escalas, voluntários e ministérios para igrejas.
- **Frontend**: React 18 + TypeScript (strict) + Vite + TailwindCSS + Zustand + TanStack Query.
- **Backend**: Supabase (PostgreSQL, Auth, RLS, Storage) + Supabase Edge Functions (Deno/TypeScript).
- **Hospedagem & Deploy**: Vercel (Frontend/Serverless) + Supabase Cloud.
- **Inteligência Artificial**: Google Gemini API (`@google/genai`) via `services/aiOrchestrator.ts` e `services/aiScheduleUtils.ts`.
- **Pagamentos**: Stripe (Checkout, Customer Portal e Webhooks).
- **Notificações**: Web Push Notifications (Service Worker + Edge Function `push-notification` + VAPID) e Notificações In-App.

---

## 2. Convenções Arquiteturais Mandatórias — NÃO Quebrar
- **Chave de escala**: Obrigatório o uso de pipe: `ruleId|date|role` (nunca alterar o separador).
- **Funções dos membros**: Armazenadas exclusivamente em `ministry_members.functions` (nunca criar campo paralelo).
- **Multi-tenancy**: Toda query ou mutação no banco DEVE filtrar explicitamente por `organization_id` e/ou `ministry_id`.
- **Supabase Client**: Instância única via [services/supabase/client.ts](services/supabase/client.ts) (nunca instanciar novo cliente fora dele).
- **Imagens e Logos**:
  - Assets institucionais do sistema em [/public/branding/](public/branding/) (preservados em loading, login e manifest PWA).
  - Logo da igreja/organização renderizado estritamente em header/sidebar (nunca substituir o logo do sistema em telas de auth).
- **Gamificação**: O nome canônico da moeda é **GloryCoin** (não renomear).
- **Planos da Organização**: `trial`, `pro`, `enterprise`.

---

## 3. Decisões Arquiteturais Fundamentadas
- **`SECURITY DEFINER` na função `is_super_admin`**: Evita recursão infinita no RLS para Super Admins globais sem `organization_id` vinculado na tabela `profiles`.
- **Chave Composta com Separador Pipe (`|`)**: Evita colisões acidentais com UUIDs e slugs que já contêm hífens ou underscores.
- **Supabase como Fonte Canônica de Membros**: A vinculação de membros a ministérios reside na tabela `ministry_members` (`profile_id`, `ministry_id`, `role`, `functions`), sendo a tabela `profiles` reservada a dados de identidade global.
- **Fallback Resiliente de Notificações**: `sendNotificationSQL` nunca trava o fluxo principal caso colunas opcionais (`action_link`, `target_user_id`) oscilem no schema, garantindo tanto o envio Web Push quanto a persistência in-app.
- **Service Worker com `injectManifest`**: O arquivo [public/sw.js](public/sw.js) é processado via VitePWA com injeção de precache, mantendo listeners ativos de `push` e `notificationclick` com navegação contextual por parâmetro `tab`.

---

## 4. Design System & Padrões Visuais
- **Cores Oficiais**:
  - Primária (Navy): `#0f1f3d` (`ministral-900`)
  - Destaque (Gold): `#c9a84c`
- **Padrão Cromático para Apontamento de Ausências**:
  - **Dia Inteiro Indisponível**: Vermelho (`bg-red-500` com ícone `<Ban />`)
  - **Domingo Manhã Indisponível**: Âmbar Solar (`bg-amber-500` com ícone `<Sun />` e indicador `M`)
  - **Domingo Noite Indisponível**: Índigo Noturno (`bg-indigo-600` com ícone `<Moon />` e indicador `N`)
  - **Disponível**: Neutro (`bg-zinc-50 dark:bg-zinc-900/50`)
- **PWA & Mobile-First**: Layouts devem respeitar touch targets mínimos e quebra responsiva de grids.

---

## 5. Backlog Ativo

### A. Pendente / Prioritário
- [ ] **[DIAGNÓSTICO] Integração Google Agenda**: Investigar em runtime o fluxo OAuth no perfil do usuário (verificar URLs de redirecionamento no Google Cloud Console e persistência do `provider_token` do Supabase).
- [ ] **[CONFIG] Validação de Secrets de Produção**:
  - Supabase Edge Functions: garantir secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `CHECKIN_SECRET_KEY`.
  - Vercel: validar paridade de `VITE_VAPID_PUBLIC_KEY` e `VITE_SUPABASE_URL` em todos os ambientes.

### B. Em Análise / Dependências Externas
- [ ] **[API] CifraClub / Vagalume**: Monitorar estabilidade dos endpoints de letras/cifras e avaliar necessidade de chave dedicada caso a API pública apresente limites de requisição.
- [x] **[TESTES] Suíte Completa de Concorrência, Resiliência e Multi-Tenancy**: 8 suítes com 32 testes automatizados executados e aprovados via Vitest (`tests/concurrency/`, `tests/multi-tenant/`, `tests/resilience/`).

### C. Débito Técnico / Refatorações Futuras
- [ ] **[REFACTOR] `ScheduleEditorV2.tsx`**: Modularizar o arquivo principal dividindo em submódulos atômicos (células de escala, modais de IA e barras de navegação mensal).
- [ ] **[PERF] Dynamic Imports**: Otimizar divisão de chunks em telas secundárias pesadas (`SuperAdminDashboard`, `AdvancedAIScreen`).

---

## 6. Contexto da Última Sessão
- **Data**: 25/10/2026
- **Realizações**:
  1. **Auditoria Profunda Multi-Agente (Teamwork) para Escalar SaaS**:
     - Conduzida auditoria profunda e adversarial com 12 subagentes cobrindo concorrência, isolamento multi-tenant, resiliência de frontend e carga simultânea.
  2. **Blindagem de Segurança BOLA e Privilege Escalation nas Edge Functions**:
     - `stripe-customer-portal` e `stripe-create-checkout`: Validação obrigatória de que o solicitante autenticado é super admin ou administrador formal daquela organização (`callerProfile.organization_id === orgId && callerProfile.is_admin === true`).
     - `push-notification`: Bloqueio de disparos cross-tenant. Administradores não super admins ficam estritamente confinados a ministérios e destinatários da sua própria `organization_id`.
     - `accept-invite`: Corrigida escalação indevida de privilégio. A aceitação do primeiro membro de um novo ministério não concede mais `profiles.is_admin = true` (administrador da igreja inteira), garantindo estritamente `ministry_members.role = 'admin'`.
  3. **Concorrência e Eliminação da Race Condition de Disponibilidade**:
     - `services/supabase/availability.ts`: Substituição do padrão destrutivo de delete total mensal por reconciliação cirúrgica por diff (`existingRows` vs `rows`). Registros inalterados nunca são deletados, eliminando a janela de zero registros observada pelo Supabase Realtime.
     - `AvailabilityScreen.tsx` & `hooks/useScreenMemos.tsx`: Implementado optimistic update imediato no cache do TanStack Query (`queryClient.setQueryData`) e proteção com `lastSavedDatesRef`, eliminando o "rollback fantasma" aos 8s e garantindo estabilidade visual absoluta.
  4. **Eliminação de Zombie Requests e Trocas de Ministério**:
     - `App.tsx`: Adicionado `switchSequenceRef` para descarte de respostas assíncronas zumbis em trocas consecutivas de ministério no header/sidebar.
  5. **Conformidade Estrita com Convenções Mandatórias**:
     - `services/supabase/repertoire.ts`: Removida leitura incorreta de `profiles.ministry_functions`. Migrado para consulta na tabela canônica `ministry_members.functions` com join em `profiles(id, name)` e deduplicação por membro.
  6. **Resiliência do Frontend e TanStack Query**:
     - `lib/queryClient.ts`: Configurado backoff exponencial com jitter (até 30s) e bloqueio imediato de retries para erros definitivos (401, 403, 404, `PGRST301`, `42501`).
     - `components/ErrorBoundary.tsx`: Substituído `process.env.NODE_ENV` por `import.meta.env.DEV` para compatibilidade estrita com runtime Vite no browser.
     - `components/ScreenErrorBoundary.tsx`: Criado Error Boundary granular por tela com botão de retry contextual.
  7. **Suíte de Testes Automatizados (Vitest)**:
     - Criados testes de concorrência de escalas (`scheduleAssignmentConcurrency.test.ts`), disputas em trocas de escala (`swapRequestConcurrency.test.ts`), isolamento multi-tenant (`tenantDataIsolation.test.ts`) e resiliência de retries (`queryClientResilience.test.ts`).
- **Validação**:
  - `npm test`: 8 arquivos e 32 testes aprovados (100% no Vitest).
  - `npm run build`: Bundles e Service Worker PWA gerados com sucesso.
  - `npm run lint` (`tsc --noEmit`): Compilação limpa sem erros de tipagem.
- **Próximo Passo**: Validação de secrets em produção e início da comercialização SaaS para novas igrejas.
