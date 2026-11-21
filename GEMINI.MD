# Ministral — Regras do Agente

## Identidade do projeto
- SaaS multi-tenant de gestão de ministérios para igrejas
- Stack: React 18 + TypeScript + Vite + TailwindCSS + Supabase + Zustand + TanStack Query
- Deploy: Vercel. Backend: Supabase Edge Functions (Deno/TypeScript)
- IA: Gemini API (@google/genai) via `services/aiOrchestrator.ts`
- Pagamentos: Stripe e Asaas. Notificações: Web Push + WhatsApp (Baileys/CodeChat)

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
1. **Race condition de disponibilidade**: mitigada com conciliação cirúrgica e optimistic update no cache TanStack Query.
2. **Ministry-switching lento**: mitigado com cancelamento sequencial via switchSequenceRef e paralelização.

## Design system
- Cor primária (navy): #0f1f3d
- Cor de destaque (gold): #c9a84c
- Mobile-first / PWA — priorizar layouts de tela pequena
- Componentes Tailwind: sem dependências de UI externas além das já instaladas

## Contexto da última sessão (atualizar ao fechar)
- Último trabalho: Integração de e-mail transacional e inbound via Resend com o domínio oficial `ministral.app` (`services/email/resend.ts`, `api/email/inbound.ts`, `api/email/send.ts`, `supabase/functions/_shared/resend.ts`, `supabase/functions/inbound-email/index.ts`, `server.ts`, `tests/resendEmail.test.ts`) e remoção total de referências a domínios antigos (`seu-dominio.com`, `ministral.com.br`, `contato.ministral@gmail.com`). Testes (`9/9`), `npm run lint` e `npm run build` aprovados.
- Próximo passo: Registrar o webhook inbound (`https://fyenjzfyjlfhvayelrpp.supabase.co/functions/v1/inbound-email`, evento `email.received`) no Resend Dashboard, adicionar `RESEND_API_KEY` na Vercel e commitar/pushar para o GitHub.
