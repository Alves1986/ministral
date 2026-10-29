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
  1. **Seleção Inteligente de Cultos da Agenda na Montagem de Playlist (`RepertoireScreen.tsx`, `utils/repertoireUtils.ts`, `tests/repertoireCultoSelection.test.ts`)**:
     - **Correção da Virada de Mês (`organizeCultosForSelection`)**: Eliminado o filtro restritivo que ocultava cultos do mês seguinte quando o usuário estava no final do mês vigente (ex: dia 28/10 ocultando o culto de 01/11 à noite e os demais de novembro). Agora todos os cultos futuros são exibidos agrupados por mês (`upcomingByMonth`).
     - **Atalhos Rápidos de 1 Clique (`quickPickCultos`)**: Adicionados cards interativos de seleção rápida para os próximos cultos imediatos da agenda (ex: Domingo Manhã e Domingo Noite), exibindo ícone de turno (☀️ Manhã / 🌙 Noite), data, horário, selo `⭐ Próximo` e contador `🎵 X` de músicas já salvas naquele culto.
     - **Isolamento Estrito por Ministério e Deduplicação Semântica de Cultos (`deduplicateEventRules`, `normalizeCultoLabel` & `organizeCultosForSelection`)**: Garantido que o seletor utilize estritamente as regras do ministério atual (evitando misturar cultos de outros ministérios da igreja com grafias parecidas como `Culto Dom - Manhã`, `Culto Dom Manhã` e `Culto de Domingo - Manhã`), deduplicando também por dia/horário e removendo a listagem de sugestões de nomes no modo de Culto Extra.
     - **Auto-seleção Resiliente**: Quando o rascunho está vazio e o culto salvo no `localStorage` já passou ou ficou inválido, o seletor aponta automaticamente para o próximo culto da agenda.
  2. **Destaque da Playlist do Próximo Culto, Arquivo de Playlists Passadas e Ranking de Louvores (`RepertoireScreen.tsx` & `repertoireUtils.ts`)**:
     - **Destaque do Próximo Culto (`partitionPlaylists`)**: A playlist correspondente ao próximo culto da agenda fica isolada e destacada no topo da aba de Repertório com card exclusivo, badge "⭐ Destaque Oficial / Próximo Culto" e atalho rápido para montagem caso ainda não tenha sido publicada.
     - **Arquivo Compacto de Playlists Passadas**: Playlists de cultos já realizados são movidas automaticamente para a seção "Histórico de Playlists Anteriores" em formato de acordeão colapsado por padrão (com controles de "Expandir todos" e "Recolher todos"), mantendo a página leve e enxuta mesmo após dezenas de cultos.
     - **Sub-Aba de Ranking de Louvores (`calculateSongsRanking` & `filterSongRanking`)**: Nova sub-aba que contabiliza todos os louvores já escolhidos na história do ministério/igreja, normalizando títulos para agrupar variações de acentuação/caixa, exibindo medalhas para o Top 3 (🥇, 🥈, 🥉), indicadores de resumo, barra proporcional de frequência, busca instantânea e histórico expansível.
  3. **Consolidação e Eliminação de Notificações Duplicadas de Playlist no Repertório**:
     - Controle de idempotência/cooldown em `services/supabase/repertoire.ts` e deduplicação visual em `NotificationCenter.tsx`.
  4. **Isolamento Estrito de Solicitações de Entrada (`join_request`) e Gateway Asaas**:
     - Isolamento por ministério em `utils/joinRequestUtils.ts` e Edge Functions Asaas operacionais.
- **Validação**:
  - `npm test`: 21 arquivos e 101 testes aprovados (100% no Vitest).
  - `npm run lint` (`tsc --noEmit`): Compilação estrita sem erros de tipagem.
  - `npm run build`: Bundles de produção e Service Worker PWA gerados com sucesso.
- **Próximo Passo**: Validação de secrets em produção e início da comercialização SaaS para novas igrejas.
