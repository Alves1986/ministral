# Pesquisa de mercado e acessibilidade — Ministral

## Soluções de referência

### Planning Center
Fonte: https://www.planningcenter.com/

A proposta reúne detalhes de ministérios em um sistema integrado, incluindo planos de culto, escalas de voluntários, ensaios, anotações de música e atribuição de pessoas a funções. O produto também destaca um app para a comunidade com consulta de escalas, comunicação de grupos, inscrições em eventos, pedidos de oração e outras formas de participação. O principal aprendizado para o Ministral é que competir exige conectar escala, comunicação e participação em uma experiência contínua, e não tratar a escala como uma tabela isolada.

### Ministry Scheduler Pro / Rotunda
Fonte: https://ministryschedulerpro.com/

A solução comunica geração automática de escalas equilibradas, mensagens e lembretes personalizados, substituições online, app móvel e suporte a famílias, equipes, rotações, autoinscrição e níveis de experiência. O principal aprendizado é transformar a escala em um sistema de cobertura e equilíbrio, com automação, justiça na distribuição e resolução de ausências de última hora.

### TouchPoint Scheduler
Fonte: https://www.touchpointsoftware.com/features/church-volunteer-scheduling-software/

A solução destaca equipes, faixas de horário, atribuições, visão de lacunas, acompanhamento de disponibilidade, inscrição online, solicitação de substitutos, padrões recorrentes, prevenção de conflitos, registro de presença e permissões para líderes. O principal aprendizado é oferecer uma visão operacional de cobertura e delegar gestão com segurança por ministério ou função.

### Pushpay
Fonte: https://pushpay.com/solutions/church-scheduling-software/

A página posiciona o produto como algo além de uma agenda, enfatizando a gestão de voluntários e a cultura de servir em um só lugar. O principal aprendizado é que o valor percebido deve ser comunicado como redução de atrito para líderes e voluntários, não apenas como cadastro de eventos.

## Acessibilidade e mobile

### WCAG 2.2 — Tamanho mínimo de alvo
Fonte: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

O critério 2.5.8 recomenda alvos de pelo menos 24 por 24 CSS pixels ou espaçamento suficiente entre alvos menores. A recomendação de usabilidade para controles importantes é preferir alvos maiores. Para o Ministral, a meta prática será manter controles primários e ações de navegação com pelo menos 44px de altura e áreas de ícone com alvo confortável em mobile.

### WCAG 2.2 — Aparência do foco
Fonte: https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html

O foco deve ser visualmente perceptível, com indicador de área suficiente e contraste de pelo menos 3:1 entre o estado focado e não focado. Para o Ministral, foco, hover, pressed, disabled e loading devem ser estados explícitos e consistentes em todos os botões.

### WCAG 2.2 — Foco não obscurecido
Fonte: https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html

O componente que recebe foco não deve ficar completamente oculto por conteúdo criado pela aplicação. Isso é especialmente relevante para a navegação inferior fixa, drawers, menus e modais do Ministral. A implementação deve usar padding de safe area, scroll-margin e gerenciamento de foco nos overlays.

## Critérios derivados

A auditoria e a implementação devem priorizar: escala tipográfica com poucos níveis e leitura confortável; botões com altura e área de toque consistentes; ações primárias visualmente claras; estados de carregamento e erro; navegação inferior sem sobrepor conteúdo; tabelas com alternativa em cards ou edição por drawer no mobile; e foco visível em todos os controles.
