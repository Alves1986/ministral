# Validação de abas e regras — 20 de agosto de 2026

## Escopo

Foram corrigidos o mapeamento das abas **IA Avançada** e **Suporte da organização** e a organização das telas **Regras de Agenda** e **Regras de Escala**, preservando a paleta Ministral, a tipografia e os arquivos de branding.

## Correções de navegação

A aba `support-admin` estava duplicada no registro global de abas. A duplicidade foi removida de `types.ts`, mantendo uma única fonte de verdade para validação, menu e rota.

Os componentes de Suporte e IA Avançada continuam associados explicitamente aos seus identificadores, mas agora também exigem presença na lista de abas autorizadas. Isso evita que uma área não habilitada seja exibida como outra tela e mantém o bloqueio de IA Avançada para organizações sem plano Pro.

O menu administrativo passou a identificar a área como **Suporte da organização**, distinguindo-a do suporte global do superadmin.

## Regras de Agenda

A tela recebeu quatro visões internas:

| Visão | Finalidade |
|---|---|
| Visão geral | Mostra o resumo combinado de eventos semanais e especiais |
| Adicionar evento | Mantém o formulário de criação em uma área dedicada |
| Eventos semanais | Exibe apenas regras recorrentes por dia e horário |
| Eventos especiais | Exibe apenas eventos de data única, com filtro mensal |

Cada visão apresenta contador real de registros e pode ser usada em viewport estreita sem exigir que o administrador percorra uma página longa.

## Regras de Escala

A tela agora apresenta quatro categorias alternáveis, com contadores reais:

| Categoria | Conteúdo |
|---|---|
| Por evento | Funções excluídas de eventos específicos |
| Entre membros | Preferências de escala conjunta e bloqueios entre pessoas |
| Grupos de bloqueio | Funções que não podem acumular na mesma escala |
| Exceções | Combinações permitidas mesmo quando existem bloqueios |

Os formulários e ações existentes foram preservados; apenas a apresentação foi segmentada para reduzir densidade, facilitar a localização da configuração e melhorar a experiência mobile.

## Validações

- `npm run lint`: aprovado.
- `npm run build`: aprovado, com apenas o aviso conhecido de chunk grande e o aviso de API Vite já existente.
- `npx vitest run`: 25 testes aprovados em 5 arquivos.
- `git diff --check`: aprovado.
- Nenhum arquivo em `public/branding/` foi alterado.
- Nenhuma dependência foi adicionada ao `package.json`.
- Nenhum segredo ou credencial de Supabase foi gravado no repositório.

A validação final de login autenticado depende de credenciais de teste do Supabase; a checagem estrutural, estática e de build não depende de login real.

## Arquivos alterados nesta entrega

- `App.tsx`
- `types.ts`
- `components/EventsScreen.tsx`
- `components/ScheduleRulesScreen.tsx`

Artefatos históricos e capturas existentes no workspace ficaram fora desta entrega.
