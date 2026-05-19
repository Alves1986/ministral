# AGENTS.md — Ministral

## Comportamento esperado do agente
- Idioma de resposta: Português brasileiro
- Ao receber uma tarefa nova, SEMPRE perguntar: "qual é o comportamento esperado quando isso funcionar?"
- Antes de implementar: confirmar entendimento da spec
- Após implementar: executar o teste ou demonstrar evidência de funcionamento

## Stack mandatório
- TypeScript strict mode em todos os arquivos
- React functional components com hooks (sem class components)
- TanStack Query para fetches de servidor (não useEffect + fetch direto)
- Zustand apenas para estado global de UI (não duplicar com React Query)
- Supabase client via `services/supabase/client.ts` (nunca criar nova instância)
- RLS ativo em todas as tabelas — qualquer query sem filtro de org/ministry é bug

## Proibido
- NÃO instalar dependências novas sem aprovação explícita
- NÃO modificar arquivos em `/public/branding/` sem instrução específica
- NÃO usar `any` em TypeScript (use `unknown` se necessário)
- NÃO fazer deploy direto no Vercel (apenas via PR)