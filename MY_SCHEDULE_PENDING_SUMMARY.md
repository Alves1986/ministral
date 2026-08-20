# Ministral — Minha escala e Central de pendências

## Objetivo

Esta etapa transforma o Ministral em uma experiência mais orientada à ação no celular. Em vez de exigir que o voluntário procure sua função dentro de uma grade administrativa, o sistema passa a oferecer uma área pessoal para compromissos futuros e uma fila única para resolver confirmações, trocas, avisos e notificações.

As cores, o logotipo, os contratos do Supabase e os fluxos administrativos existentes foram preservados.

## O que foi implementado

| Área | Entrega |
|---|---|
| `Minha escala` | Nova tela pessoal com próximos compromissos, função atribuída, horário, estado de confirmação e atalho para trocas. |
| `Central de pendências` | Nova fila agregada com confirmações de presença, solicitações de troca compatíveis, avisos não lidos e notificações não lidas. |
| Confirmação | A ação de confirmar presença reutiliza o `ConfirmationModal` e o handler existente de `toggleAssignmentConfirmation`. |
| Navegação desktop | As novas áreas aparecem no início do menu principal e nos atalhos rápidos. |
| Navegação mobile | A barra inferior prioriza `Início`, `Minha escala`, `Pendências`, `Agenda` e `Menu`; o calendário completo permanece disponível no menu lateral. |
| Compatibilidade | As duas abas são adicionadas ao contrato global e ficam disponíveis também para configurações antigas de ministério. |

## Decisões de experiência

A tela `Minha escala` é centrada no voluntário e deve responder rapidamente a três perguntas: onde preciso estar, qual função vou executar e o que ainda preciso confirmar. A `Central de pendências` é orientada ao próximo passo, evitando estados sem ação clara e encaminhando cada item para o fluxo já existente no sistema.

A primeira versão não cria uma segunda regra de negócio para trocas ou presença. Ela reutiliza os dados carregados pelo `useMinistryData`, as solicitações existentes e o modal transversal de confirmação. Isso reduz risco de divergência entre a visão pessoal e a gestão da escala.

## Validações

`npm run lint`, `npm run build`, `npx vitest run` e `git diff --check` foram executados. Os quatro arquivos de teste existentes, com 21 testes, passaram. O build continua emitindo apenas o aviso preexistente sobre chunks maiores que 500 kB; esse ponto deve ser tratado separadamente com code splitting e carregamento sob demanda.

A inspeção visual em viewport mobile confirmou o carregamento da tela pública com o logotipo e a paleta atuais. A tela autenticada não pôde ser exercitada no navegador local por ausência de sessão, portanto recomenda-se validar os estados preenchido, vazio e com pendências em uma conta de teste antes do merge.

## Próximos passos recomendados

A próxima evolução deve conectar a ação `Solicitar troca` diretamente ao formulário contextual, permitindo que o voluntário abra uma solicitação já preenchida com evento e função. Em seguida, a central deve receber ações de leitura/arquivamento para notificações e avisos, além de uma visão administrativa com aprovações de entrada e substituições aguardando decisão.
