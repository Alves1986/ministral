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
- [ ] **[TESTES] Suíte Completa de Componentes**: Ajustar configuração de testes unitários para permitir execução com `@testing-library/react` e `@testing-library/jest-dom` v6 sem conflitos de dependências.

### C. Débito Técnico / Refatorações Futuras
- [ ] **[REFACTOR] `ScheduleEditorV2.tsx`**: Modularizar o arquivo principal dividindo em submódulos atômicos (células de escala, modais de IA e barras de navegação mensal).
- [ ] **[PERF] Dynamic Imports**: Otimizar divisão de chunks em telas secundárias pesadas (`SuperAdminDashboard`, `AdvancedAIScreen`).

---

## 6. Contexto da Última Sessão
- **Data**: 20/10/2026
- **Realizações**:
  1. **Auditoria e Blindagem de Notificações e Solicitações de Entrada**:
     - Corrigido o fluxo de aprovação de solicitações de entrada (`join_request`): blindado [MembersScreen.tsx](components/MembersScreen.tsx) com avatar, nome real, e-mail e citação da notificação original, além de resolução automática de perfis (`profiles`) e seletor manual de vinculação para notificações legadas ou com nomes genéricos ("Novo Integrante").
     - Atualizado [NotificationCenter.tsx](components/NotificationCenter.tsx) para redirecionar o clique em solicitações de entrada diretamente para a aba de membros com o ministério correto já selecionado.
     - Adicionado banner de alerta e badge numérico no item de menu "Membros" em [DashboardLayout.tsx](components/DashboardLayout.tsx) e [App.tsx](App.tsx) quando houver solicitações aguardando aprovação.
     - Blindado `fetchNotificationsSQL` em [services/supabase/notifications.ts](services/supabase/notifications.ts) para sempre retornar `type = join_request` para administradores e nunca quebrar com erro 400.
     - Unificados ministérios permitidos e ministério ativo em [useMinistryQueries.ts](hooks/useMinistryQueries.ts) para nunca perder notificações do ministério selecionado.
     - Criada migração idempotente [20261020_add_target_user_id_to_notifications.sql](supabase/migrations/20261020_add_target_user_id_to_notifications.sql) adicionando `target_user_id` e `action_link`.
     - Corrigido registro automático de inscrição Web Push e deep-links contextuais.
  2. **Organização da Documentação**:
     - Criação de [docs/agent-context/MINISTRAL_HISTORY.md](docs/agent-context/MINISTRAL_HISTORY.md) preservando 100% do histórico técnico e das auditorias passadas.
     - Otimização do `Ministral.MD` como índice ágil e confiável com backlog ativo estruturado por estado.
     - Refinamento de `AGENTS.MD` com regras permanentes.
- **Validação**: `npm run build` aprovado gerando bundles e service worker sem advertências impeditivas.
- **Próximo Passo**: Teste de ponta a ponta no mobile e aprovação da solicitação de entrada de teste.

