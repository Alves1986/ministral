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
- **Pagamentos**: Stripe e Asaas (PIX, Boleto, Cartão de Crédito, Checkout e Webhooks).
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
- [ ] **[CONFIG] Inserir a chave `NVIDIA_API_KEY` no painel da Vercel** (variável já criada, produção/preview/development).
- [ ] **[CONFIG] Validação de Secrets de Produção**:
  - Supabase Edge Functions: garantir secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `CHECKIN_SECRET_KEY`.
  - Vercel: validar paridade de `VITE_VAPID_PUBLIC_KEY` e `VITE_SUPABASE_URL` em todos os ambientes.

### B. Em Análise / Dependências Externas
- [x] **[API] CifraClub / Vagalume**: Integração removida em 18/11/2026 (recurso sem uso). Endpoints, serviços, telas e a dependência `vagalume` foram eliminados.
- [x] **[TESTES] Suíte Completa de Concorrência, Resiliência e Multi-Tenancy**: 8 suítes com 32 testes automatizados executados e aprovados via Vitest (`tests/concurrency/`, `tests/multi-tenant/`, `tests/resilience/`).

### C. Débito Técnico / Refatorações Futuras
- [ ] **[REFACTOR] `ScheduleEditorV2.tsx`**: Modularizar o arquivo principal dividindo em submódulos atômicos (células de escala, modais de IA e barras de navegação mensal).
- [ ] **[PERF] Dynamic Imports**: Otimizar divisão de chunks em telas secundárias pesadas (`SuperAdminDashboard`, `AdvancedAIScreen`).

---

## 6. Contexto da Última Sessão
- **Data**: 21/11/2026
- **Realizações**:
  1. **Integração Resend e Domínio Oficial `ministral.app` (`services/email/resend.ts`, `api/email/inbound.ts`, `api/email/send.ts`, `supabase/functions/_shared/resend.ts`, `supabase/functions/inbound-email/index.ts`, `server.ts`, `tests/resendEmail.test.ts`)**:
     - **Wrapper Singleton Resend (`services/email/resend.ts` & `supabase/functions/_shared/resend.ts`)**: Cliente compatível com `resend.emails.send` + helper `sendEmail` usando `fetch` nativo para `https://api.resend.com/emails`, com defaults `Ministral <noreply@ministral.app>` e `reply_to: suporte@ministral.app`.
     - **Webhook Inbound de E-mails (`api/email/inbound.ts` & `supabase/functions/inbound-email/index.ts`)**: Endpoints prontos para receber eventos `email.received` do Resend tanto via Vercel (`https://ministral.app/api/email/inbound`) quanto via Supabase Edge Function (`/functions/v1/inbound-email`), com verificação opcional de assinatura HMAC-SHA256 Svix (`RESEND_WEBHOOK_SECRET`).
     - **Remoção de Domínios Antigos & Deploy Supabase**: Atualizados `validate-invite`, `accept-invite`, `push-notification`, `push-reminders`, `stripe-create-checkout`, `stripe-customer-portal`, `api/ai/run.ts`, `components/LegalDocuments.tsx`, `components/LockScreens.tsx` e `index.html` para `ministral.app` / `suporte@ministral.app`. 6 secrets gravadas no projeto `fyenjzfyjlfhvayelrpp`, 7 Edge Functions deployadas e endpoint `inbound-email` validado em produção (`200 OK`).
  2. **Correções de IA e Remoção de Legados (18/11/2026)**: Imports `.js` nas Vercel Functions, remoção de integrações sem uso (Spotify, CifraClub/Vagalume) e adição do provedor NVIDIA NIM (`NVIDIA_API_KEY`).
- **Validação**:
  - `npx tsc --noEmit`: sem erros.
  - `npx vitest run tests/resendEmail.test.ts`: 9/9 testes aprovados.
  - `npm run build`: bundles e Service Worker PWA gerados.
- **Próximo Passo**: Registrar o webhook inbound no Resend Dashboard (`email.received`) e validar o envio/recebimento real em produção.

