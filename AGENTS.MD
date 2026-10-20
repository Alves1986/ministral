# AGENTS.md — Regras Permanentes e Fluxo do Agente

Este arquivo define as **regras permanentes de comportamento, restrições e fluxo de trabalho** para qualquer agente atuando no repositório Ministral.

---

## 1. Inicialização Obrigatória
Antes de iniciar qualquer tarefa, siga esta ordem de leitura:
1. [Ministral.MD](Ministral.MD) — Índice de arquitetura, convenções mandatórias, estado ativo e backlog.
2. Este arquivo ([AGENTS.MD](AGENTS.MD)) — Regras de comportamento e restrições operacionais.
3. [docs/agent-context/MINISTRAL_HISTORY.md](docs/agent-context/MINISTRAL_HISTORY.md) — Consultar **apenas se** a tarefa exigir resgate de histórico técnico ou auditorias passadas.

Ao iniciar uma nova sessão ou tarefa, confirme com o formato:
> "Contexto carregado. Último trabalho: [resumo de 1 linha do Ministral.MD]. Próximo passo: [próximo item do backlog]. Pronto para começar."

---

## 2. Comportamento e Princípios Operacionais
- **Idioma**: Português brasileiro em todas as respostas e documentações.
- **Alinhamento**: Em tarefas novas, esclarecer o comportamento esperado caso haja ambiguidade real.
- **Evidências obrigatórias**: Nunca declarar uma tarefa como concluída sem evidência observável (execução de build, linter, testes ou logs).
- **Alterações pontuais**: Fazer alterações pequenas, localizadas e com foco cirúrgico na solicitação.
- **Preservação**: Preservar segurança, isolamento multi-tenant e integridade do histórico do projeto.

---

## 3. Ciclo de Trabalho por Tarefa

```
1. ENTENDER    → Ler o contexto em Ministral.MD e definir escopo da tarefa.
2. CONFIRMAR   → Alinhar dúvidas conceituais antes de tocar no código.
3. PLANEJAR    → Identificar os arquivos exatos a serem modificados e riscos de regressão.
4. IMPLEMENTAR → Aplicar as alterações respeitando convenções e arquitetura.
5. EVIDENCIAR  → Validar com testes/build/lint antes de reportar.
6. REGISTRAR   → Atualizar Ministral.MD e criar commit convencional.
```

---

## 4. Papéis do Agente (Rotação por Contexto)

| Quando o desenvolvedor pedir | Comportamento esperado |
|---|---|
| **"revise antes de implementar"** | Atuar como arquiteto — apontar riscos, alternativas e impacto em outras partes do sistema. |
| **"faça code review"** | Atuar como segundo dev — verificar tipagem, RLS, convenções, performance e segurança. |
| **"quais são os riscos?"** | Atuar como crítico — mapear regressões em potencial, edge cases e impactos em mobile/PWA. |
| **"debug mode"** | Atuar como debugger — propor 3 hipóteses ordenadas por probabilidade antes de alterar código. |
| **"próxima tarefa do backlog"** | Consultar a seção prioritária do backlog em [Ministral.MD](Ministral.MD) e iniciar o ciclo de trabalho. |

---

## 5. Diretrizes da Stack
- **TypeScript**: Strict mode em todos os arquivos; evitar `any` (utilizar tipos específicos ou `unknown`).
- **React**: Componentes funcionais com hooks; sem class components.
- **TanStack Query**: Padrão para fetch e mutações de dados do servidor com cache inteligente.
- **Zustand**: Reservado estritamente para estado de UI global (sem duplicar cache do servidor).
- **Supabase**: Acesso exclusivo via instância unificada em [services/supabase/client.ts](services/supabase/client.ts).
- **Multi-Tenancy & RLS**: RLS obrigatório em todas as tabelas. Todas as consultas e mutações devem filtrar por `organization_id` e/ou `ministry_id`.
- **Edge Functions**: Ambiente Deno/TypeScript no diretório `supabase/functions/`.

---

## 6. Proibições Críticas
- **NÃO** declarar tarefas concluídas sem testes, builds ou provas de funcionamento.
- **NÃO** alterar código, banco de dados ou schemas quando a tarefa for exclusivamente de documentação/contexto.
- **NÃO** instalar pacotes ou dependências sem autorização prévia.
- **NÃO** modificar arquivos em `/public/branding/` sem instrução específica.
- **NÃO** alterar a chave de escala composta `ruleId|date|role` nem o separador pipe (`|`).
- **NÃO** criar nova instância de Supabase Client fora de `services/supabase/client.ts`.
- **NÃO** reverter decisões arquiteturais catalogadas em [Ministral.MD](Ministral.MD) sem discussão prévia.

---

## 7. Padrão de Commits (Conventional Commits)
```
feat: descrição curta da nova funcionalidade
fix: descrição curta da correção de bug
refactor: alterações de código sem mudança de comportamento externo
test: adição ou correção de testes
docs: atualizações em arquivos de documentação e contexto
chore: ajustes de build, dependências ou tarefas operacionais
```

---

## 8. Ritual de Fechamento de Sessão
Ao concluir uma sessão de trabalho:
1. Atualizar o bloco "Contexto da última sessão" em [Ministral.MD](Ministral.MD).
2. Atualizar o backlog ativo, marcando ou arquivando itens finalizados.
3. Se houver novo histórico técnico extenso, registrar em [docs/agent-context/MINISTRAL_HISTORY.md](docs/agent-context/MINISTRAL_HISTORY.md).
4. Commitar com mensagem: `docs: atualiza contexto da sessão`.