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
- **Data**: 06/11/2026
- **Realizações**:
  1. **Filtro Estrito de Trocas de Escala por Função (`utils/swapUtils.ts`, `components/SwapRequestsScreen.tsx`, `services/supabase/misc.ts`, `tests/swapRoleFilter.test.ts`)**:
     - **Mural de Trocas (`SwapRequestsScreen.tsx` & `isSwapRequestVisibleToUser`)**: Removido o bypass de admin e o bypass para membros sem funções cadastradas; o mural exibe pedidos de troca apenas para quem possui a mesma função do pedido (normalizada com `trim` + case-insensitive) ou para o próprio solicitante, consultando as funções frescas do membro em `ministry_members` e respeitando `[]` quando o membro não possui funções no banco.
     - **Notificações Direcionadas por Função (`createSwapRequestSQL` & `getSwapNotificationRecipientIds`)**: Notificações de novo pedido de troca são enviadas com `targetUserId` exclusivamente para os membros que possuem a função correspondente (excluindo o próprio solicitante e admins sem a função).
     - **Guarda de Segurança ao Assumir Troca (`performSwapSQL` & `hasMatchingSwapRole`)**: Validação no serviço impedindo que um usuário sem a função correspondente assuma a vaga.
  2. **Edição de Avisos Exclusiva pelo Autor/Criador (`utils/announcementUtils.ts`, `services/supabase/notifications.ts`, `components/AnnouncementCard.tsx`, `components/AnnouncementsScreen.tsx`, `components/AlertsManager.tsx`, `hooks/useScreenMemos.tsx`, `tests/announcementEditPermission.test.ts`)**:
     - **Persistência Resiliente da Identidade do Autor**: Codificação transparente do UUID do autor em `author_name` (`encodeAnnouncementAuthor` / `parseAnnouncementAuthor`) evitando erro `PGRST204` no Supabase quando a coluna `created_by` não existe no schema e garantindo que `external_link` e `is_pinned` também sejam preservados.
     - **Permissão Estrita para o Criador (`canUserEditAnnouncement`)**: Apenas quem criou o aviso pode visualizar o botão `Editar` e salvar alterações (título, mensagem, tipo de alerta, expiração e link externo), bloqueando outros administradores/líderes que não criaram aquele aviso e suportando avisos legados por correspondência exata do nome do autor.
  3. **Sincronização Completa com Eventos do Calendário e Edição de Playlists (`RepertoireScreen.tsx`, `utils/repertoireUtils.ts`, `tests/repertoireCultoSelection.test.ts`)**:
     - **Exibição de Todos os Eventos do Calendário**: Sincronizadas as exclusões de agenda (`__EVENT_EXCLUDED__` em `schedule_assignments`) e removida a ocultação por horário, permitindo que eventos distintos do ministério no mesmo horário apareçam todos na lista de seleção sem necessidade de "Culto Extra".
     - **Edição Completa de Playlists e Louvores**: Adicionado botão `Editar Playlist` em cada card, exibição dos louvores já salvos no painel `Playlist em Montagem` e botão `Editar` (lápis) em cada louvor para atualizar título, link, tom e cifra.
- **Validação**:
  - `npm test`: 23 arquivos e 113 testes aprovados (100% no Vitest).
  - `npm run lint` (`tsc --noEmit`): Compilação estrita sem erros de tipagem.
  - `npm run build`: Bundles de produção e Service Worker PWA gerados com sucesso.
- **Próximo Passo**: Validação de secrets em produção e início da comercialização SaaS para novas igrejas.
