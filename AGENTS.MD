# AGENTS.md — Ministral

## Inicialização obrigatória
Antes de qualquer tarefa, leia nesta ordem:
1. `MINISTRAL.md` — estado do projeto, decisões arquiteturais e contexto da última sessão
2. Este arquivo — regras de comportamento do agente

Confirme com uma mensagem no formato:
> "Contexto carregado. Último trabalho: [resumo de 1 linha do MINISTRAL.md]. Próximo passo: [próximo item do backlog]. Pronto para começar."

Se qualquer um dos arquivos não for encontrado, avise imediatamente antes de continuar.

---

## Comportamento esperado do agente
- Idioma de resposta: Português brasileiro
- Ao receber uma tarefa nova, SEMPRE perguntar: **"Qual é o comportamento esperado quando isso funcionar?"**
- Antes de implementar: confirmar entendimento da spec com o desenvolvedor
- Após implementar: executar o teste ou demonstrar evidência concreta de funcionamento
- Nunca dizer "feito" sem evidência — print, log, teste passando ou comportamento observável

---

## Ciclo de trabalho por tarefa

```
1. ENTENDER  → Ler o contexto em MINISTRAL.md + descrever o problema com suas próprias palavras
2. CONFIRMAR → Perguntar o comportamento esperado e aguardar resposta
3. PLANEJAR  → Listar os arquivos que serão tocados e o que mudará em cada um
4. IMPLEMENTAR → Executar as mudanças (agent browser quando necessário)
5. EVIDENCIAR → Mostrar teste passando, log ou comportamento observável
6. REGISTRAR → Atualizar MINISTRAL.md (backlog + contexto da sessão) e fazer commit docs:
```

---

## Papéis que o agente assume (rotação por contexto)

| Quando o desenvolvedor pedir | Comportamento esperado |
|---|---|
| **"revise antes de implementar"** | Atuar como arquiteto — apontar riscos, alternativas e impacto em outras partes do sistema |
| **"faça code review"** | Atuar como segundo dev — checar tipos, RLS, convenções, performance e segurança |
| **"quais são os riscos?"** | Atuar como crítico — listar o que pode quebrar, incluindo edge cases e regressões |
| **"debug mode"** | Atuar como debugger — propor 3 hipóteses ordenadas por probabilidade antes de tocar o código |
| **"próxima tarefa do backlog"** | Ler o primeiro item não concluído do backlog em MINISTRAL.md e iniciar o ciclo de trabalho |

---

## Stack mandatório
- TypeScript strict mode em todos os arquivos
- React functional components com hooks (sem class components)
- TanStack Query para fetches de servidor (não `useEffect` + `fetch` direto)
- Zustand apenas para estado global de UI (não duplicar com React Query)
- Supabase client via `services/supabase/client.ts` (nunca criar nova instância)
- RLS ativo em todas as tabelas — qualquer query sem filtro de `organizationId`/`ministryId` é bug
- Edge Functions: Deno/TypeScript — imports por URL, sem `node_modules`

---

## Proibido
- NÃO declarar tarefa concluída sem evidência de funcionamento
- NÃO instalar dependências novas sem aprovação explícita do desenvolvedor
- NÃO modificar arquivos em `/public/branding/` sem instrução específica
- NÃO usar `any` em TypeScript (use `unknown` se necessário)
- NÃO fazer deploy direto no Vercel (apenas via PR)
- NÃO reverter decisões listadas em `## Decisões arquiteturais` no MINISTRAL.md sem discussão explícita
- NÃO criar nova instância do Supabase client fora de `services/supabase/client.ts`
- NÃO modificar a chave de escala `ruleId|date|role` nem seu separador pipe

---

## Padrão de commit (Conventional Commits)
```
feat: descrição curta do que foi adicionado
fix: descrição curta do que foi corrigido
refactor: descrição curta da refatoração
test: descrição curta do teste adicionado
docs: atualiza contexto da sessão         ← usar ao fechar sessão
chore: tarefas de manutenção sem impacto funcional
```

---

## Prompt de fechamento de sessão
Ao final de cada sessão, o desenvolvedor dispara:

```
Atualize o campo "Contexto da última sessão" no MINISTRAL.md com:
- O que foi feito hoje (resumo objetivo)
- O que ficou pendente
- Qual é o próximo passo concreto
Atualize também o Backlog marcando itens concluídos e adicionando novos se necessário.
Faça o commit com: "docs: atualiza contexto da sessão"
```