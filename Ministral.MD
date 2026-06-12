# Ministral — Regras do Agente

## Identidade do projeto
- SaaS multi-tenant de gestão de ministérios para igrejas
- Stack: React 18 + TypeScript + Vite + TailwindCSS + Supabase + Zustand + TanStack Query
- Deploy: Vercel. Backend: Supabase Edge Functions (Deno/TypeScript)
- IA: Gemini API (@google/genai) via `services/aiOrchestrator.ts`
- Pagamentos: Stripe. Notificações: Web Push + WhatsApp (Evolution API v2.2.3 — evoapicloud fork)
- Evolution API hospedada em: `testeministral.onrender.com` + Prisma Cloud (sessões)

## Convenções arquiteturais — NÃO quebre estas regras
- Chave de escala usa pipe: `ruleId|date|role` (nunca mudar separador)
- Funções dos membros ficam em `ministry_members.functions` (não em outro campo)
- Imagens do sistema em `/public/branding/` — logo do sistema preservado em loading/login/PWA
- Logo da igreja aparece APENAS em header/sidebar (nunca em telas de sistema)
- GloryCoin é o nome final da moeda de gamificação (não renomear)
- Planos: trial / pro / enterprise
- Multi-tenancy: sempre filtrar por `organizationId` + `ministryId`

## Decisões arquiteturais (não reverter sem discussão)
- **Chave `ruleId|date|role` com pipe**: evita colisão com IDs que contêm hífen ou underscore
- **`SECURITY DEFINER` em `is_super_admin`**: evita recursão infinita no RLS para Super Admin sem `organization_id` atrelado no `profiles`
- **Fallback para texto numerado no WhatsApp**: botões `/message/sendButtons` não funcionam em todos os dispositivos — fallback é obrigatório, não opcional
- **evoapicloud fork do Evolution API**: contém migração Prisma hardcoded que roda antes do servidor iniciar — qualquer ambiente de deploy precisa de DB Prisma válido pré-configurado ou o serviço não sobe
- **Supabase como única fonte de verdade**: estado de confirmação/recusa/troca de voluntários é gravado via webhook (`whatsapp-webhook`) diretamente no DB — nunca via frontend

## Regras de desenvolvimento
- NUNCA declare uma tarefa concluída sem evidência de que funciona
- SEMPRE escreva o teste que falha ANTES de implementar a correção (TDD)
- Qualquer alteração em Edge Functions DEVE ser testada localmente com `supabase functions serve`
- Ao refatorar componentes grandes (ScheduleEditorV2, App.tsx), dividir em tarefas atômicas
- Commits: Conventional Commits obrigatório (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`)

## Bugs conhecidos (contexto ativo)
1. **Race condition de disponibilidade**: conflito entre optimistic UI e Supabase Realtime em `AvailabilityScreen.tsx` — Realtime reseta estado após optimistic update. Solução planejada: flag `isSyncing` para bloquear atualização do Realtime enquanto optimistic update estiver pendente
2. **Ministry-switching lento**: roundtrips sequenciais em `onSwitchMinistry` dentro de `SessionContext.tsx` — paralelizar com `Promise.all`

## Edge Functions WhatsApp (em desenvolvimento)
- `whatsapp-reminders/index.ts` — envia lembretes com botões interativos; fallback automático para texto numerado
- `whatsapp-webhook/index.ts` — recebe respostas (`CONFIRMAR`, `RECUSAR`, `TROCA`) e grava em: `check_ins`, `absences`, `swap_requests`
- Status: rascunhos prontos, pendente validação e teste end-to-end com payload real

## Design system
- Cor primária (navy): `#0f1f3d`
- Cor de destaque (gold): `#c9a84c`
- Mobile-first / PWA — priorizar layouts de tela pequena
- Componentes Tailwind: sem dependências de UI externas além das já instaladas

## Backlog (ordem de prioridade)
- [x] **[FEAT]** Login via Google restrito — apenas membros já cadastrados podem logar; novos usuários recebem erro amigável
- [ ] **[BUG]** Race condition `AvailabilityScreen.tsx` — implementar flag `isSyncing` para bloquear Realtime durante optimistic update
- [ ] **[BUG]** Ministry-switching lento — paralelizar `Promise.all` em `onSwitchMinistry` / `SessionContext.tsx`
- [ ] **[FEAT]** Validar fluxo end-to-end WhatsApp botões — testar `CONFIRMAR`, `RECUSAR`, `TROCA` com payload real da Evolution API
- [ ] **[FEAT]** Edge Function `whatsapp-webhook` — validar gravação em `check_ins`, `absences`, `swap_requests` no Supabase
- [ ] **[FEAT]** Edge Function `whatsapp-reminders` — validar envio de lembretes e fallback para texto numerado
- [ ] **[REFACTOR]** `ScheduleEditorV2` — dividir em componentes atômicos (tarefa a definir em sessão específica)
- [ ] **[FEAT]** Notificações de swap aprovado — notificar voluntário via WhatsApp quando troca for aceita

## Contexto da última sessão (atualizar ao fechar)
- **Último trabalho**: Implementação completa do Login via Google restrito. Código adicionado em `services/supabase/auth.ts` (`loginWithGoogle`), `components/LoginScreen.tsx` (botão + tratamento de erro `access_denied`), `context/SessionContext.tsx` (logout de ghost accounts). Configuração externa: Google Provider habilitado no Supabase com Client ID/Secret corretos; URL de callback `https://fyenjzfyjlfhvayelrpp.supabase.co/auth/v1/callback` adicionada ao Google Cloud Console. "Allow new users to sign up" desabilitado no Supabase para bloquear cadastros não convidados.
- **O que ficou pendente**: Teste end-to-end do fluxo de login Google com uma conta real de membro.
- **Próximo passo**: corrigir race condition em `AvailabilityScreen.tsx` (flag `isSyncing`) — topo do backlog

---

## Ritual de fechamento de sessão
Antes de encerrar, dispare este prompt para o agente:

```
Atualize o campo "Contexto da última sessão" no MINISTRAL.md com:
- O que foi feito hoje (resumo objetivo)
- O que ficou pendente
- Qual é o próximo passo concreto
Atualize também o Backlog marcando itens concluídos e adicionando novos se necessário.
Faça o commit com: "docs: atualiza contexto da sessão"
```