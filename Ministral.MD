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
- **Data**: 28/10/2026
- **Realizações**:
  1. **Consolidação e Eliminação de Notificações Duplicadas de Playlist no Repertório**:
     - **Causa Raiz Identificada**: Ao publicar uma playlist, `notifyRepertoirePlaylistPublished` disparava simultaneamente: broadcast para o Louvor, broadcast para ministérios de Projeção, broadcast para ministérios de Dança, loops individuais por voluntário com funções de dança/projeção (`targetUserId: p.id`) e disparo global para todos os administradores da plataforma via `notifySuperAdmins`. Um líder/admin com múltiplos papéis (ex: Louvor + Dança + Super Admin) recebia de 3 a 5 notificações simultâneas para o mesmo culto.
     - **Correção no Backend (`services/supabase/repertoire.ts`)**:
       - Adicionado controle de idempotência e cooldown com `canDispatchPlaylistNotification` (trava em memória de 15s por organização, ministério, data e regra de evento), evitando disparos repetidos por múltiplos cliques no salvamento.
       - Removido disparo desnecessário para Super Admins (`notifySuperAdmins`), pois a publicação de playlist é evento interno/operacional do ministério e não evento crítico de plataforma.
       - Eliminada duplicação de notificações individuais: quando a organização já possui ministérios dedicados de Projeção ou Dança, dispara apenas o broadcast para o ministério correspondente. O envio individual para membros com função específica via `targetUserId` passa a atuar estritamente como fallback quando a igreja não possui ministérios parceiros cadastrados.
     - **Deduplicação na Interface (`components/NotificationCenter.tsx` e `utils/repertoireUtils.ts`)**:
       - Implementadas as funções `extractPlaylistNotificationKey` e `deduplicatePlaylistNotifications` para consolidar notificações legadas ou repetidas da mesma playlist/culto em uma única notificação limpa no dropdown e no badge de contagem (`unreadCount`).
       - Ao marcar como lida ou dispensar uma notificação de playlist consolidada, todas as notificações irmãs daquele culto são marcadas como lidas ou removidas no banco de dados em conjunto.
     - **Suíte de Testes Unitários**:
       - Criado `tests/repertoirePlaylistNotification.test.ts` com 5 testes aprovados cobrindo extração de chaves canônicas de culto/data, debounce/cooldown e consolidação de múltiplas notificações de Louvor, Dança e Projeção.
  2. **Isolamento Estrito de Solicitações de Entrada (`join_request`) entre Ministérios**:
     - Criado helper utilitário `utils/joinRequestUtils.ts` com funções `extractMinistryIdFromNotification`, `isNotificationForMinistry` e `validateJoinMinistryEligibility`, acompanhado por testes em `tests/joinRequestIsolation.test.ts`.
     - `join_request` filtrado estritamente pelos ministérios onde o usuário é administrador (`and(type.eq.join_request,ministry_id.in(...))`).
     - Corrigido `notifySuperAdmins`: restringe notificações e Web Push estritamente aos administradores do ministério alvo.
     - Corrigido `components/MembersScreen.tsx`: eliminada exibição de solicitações de entrada de outros ministérios na aba de membros.
     - Corrigido `components/NotificationCenter.tsx`: bloqueio seguro de navegação cruzada indevida entre ministérios.
  3. **Trava contra Solicitações Duplicadas ou em Ministérios já Integrados**:
     - Em `services/supabase/ministries.ts` (`joinMinistry`): travas ativas impedindo criação de novas solicitações se o voluntário já for membro ou já possuir solicitação pendente.
  4. **Higienização de Mensagens de Solicitação de Entrada**:
     - Sanitização ativa em `utils/joinRequestUtils.ts` removendo metadados brutos e JSON expostos na interface e em Web Push.
  5. **Integração do Gateway de Pagamentos Asaas**:
     - Edge Functions `asaas-create-checkout`, `asaas-webhook` e `asaas-customer-portal` com Sandbox e Produção.
     - Painel "Testar Pagamentos" no Super Admin (`sa-payments`).
- **Validação**:
  - `npm test`: 19 arquivos e 91 testes aprovados (100% no Vitest).
  - `npm run lint` (`tsc --noEmit`): Compilação estrita sem erros de tipagem.
  - `npm run build`: Bundles de produção e Service Worker PWA gerados com sucesso.
- **Próximo Passo**: Validação de secrets em produção e início da comercialização SaaS para novas igrejas.
