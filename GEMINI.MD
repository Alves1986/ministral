# Ministral — Regras do Agente

## Identidade do projeto
- SaaS multi-tenant de gestão de ministérios para igrejas
- Stack: React 18 + TypeScript + Vite + TailwindCSS + Supabase + Zustand + TanStack Query
- Deploy: Vercel. Backend: Supabase Edge Functions (Deno/TypeScript)
- IA: Gemini API (@google/genai) via `services/aiOrchestrator.ts`
- Pagamentos: Stripe. Notificações: Web Push + WhatsApp (Baileys/CodeChat)

## Convenções arquiteturais — NÃO quebre estas regras
- Chave de escala usa pipe: `ruleId|date|role` (nunca mudar separador)
- Funções dos membros ficam em `ministry_members.functions` (não em outro campo)
- Imagens do sistema em `/public/branding/` — logo do sistema preservado em loading/login/PWA
- Logo da igreja aparece APENAS em header/sidebar (nunca em telas de sistema)
- GloryCoin é o nome final da moeda de gamificação (não renomear)
- Planos: trial / pro / enterprise
- Multi-tenancy: sempre filtrar por `organizationId` + `ministryId`

## Regras de desenvolvimento
- NUNCA declare uma tarefa concluída sem evidência de que funciona
- SEMPRE escreva o teste que falha ANTES de implementar a correção (TDD)
- Qualquer alteração em Edge Functions DEVE ser testada localmente com `supabase functions serve`
- Ao refatorar componentes grandes (ScheduleEditorV2, App.tsx), dividir em tarefas atômicas
- Commits: Conventional Commits obrigatório (`feat:`, `fix:`, `refactor:`, `test:`)

## Bugs conhecidos (contexto ativo)
1. **Race condition de disponibilidade**: conflito entre otimistic UI e Supabase Realtime em `AvailabilityScreen.tsx` — Realtime reseta estado após otimistic update
2. **Ministry-switching lento**: roundtrips sequenciais em `onSwitchMinistry` dentro de `SessionContext.tsx` — paralelizar com `Promise.all`

## Design system
- Cor primária (navy): #0f1f3d
- Cor de destaque (gold): #c9a84c
- Mobile-first / PWA — priorizar layouts de tela pequena
- Componentes Tailwind: sem dependências de UI externas além das já instaladas

## Contexto da última sessão (atualizar ao fechar)
- Último trabalho: Debugging severo de regressão na UI do Editor de Escalas (ScheduleEditorV2). Funções desapareceram pois `fetchMinistrySettings` pedia colunas inexistentes no DB (`practical_guidelines`, etc), causando erro 400 silencioso e fallback para a role default 'Membro'. Adicionado `fix_ministry_settings_schema.sql` para corrigir o DB.
- Refatoração SQL: Função `is_super_admin` foi restaurada usando `SECURITY DEFINER` para evitar recursão infinita no RLS sem quebrar o acesso de contas Super Admin que não possuem `organization_id` atrelado no `profiles`.
- Próximo passo: corrigir race condition em AvailabilityScreen.tsx (flag isSyncing).