# Proposta de evolução do Ministral

**Objetivo.** Transformar o Ministral em um centro de operação de ministérios: simples para o voluntário no celular, eficiente para o líder na criação e manutenção das escalas e confiável para a igreja acompanhar cobertura, conflitos, comunicação e presença. A identidade atual deve ser preservada: **não alterar cores, logotipo ou linguagem visual de marca**; a evolução será feita por tipografia, hierarquia, espaçamento, componentes, estados e fluxo.

## Diagnóstico da base atual

A aplicação já possui uma boa fundação funcional: navegação lateral e inferior, tema claro/escuro, PWA, seleção de membros com comportamento específico para mobile, indicadores de conflitos, controle de presença e estados de disponibilidade. O build de produção passa, mas a auditoria mostra que a experiência ainda depende de muitas decisões locais de estilo. Em um inventário do código, foram encontrados aproximadamente **339 elementos de botão**, centenas de combinações de pesos tipográficos e muitos padrões de padding, radius e estados escritos diretamente nos componentes. Isso aumenta a chance de inconsistência entre telas e torna a evolução global mais lenta.

A tipografia está configurada como **Inter**, porém o uso prático é fragmentado entre `text-xs`, `text-sm`, `text-lg`, pesos `font-bold`, `font-black` e títulos com tracking muito apertado. Em telas de operação, isso produz uma hierarquia visual agressiva: labels em caixa alta e muito espaçamento competem com os dados que o líder precisa ler rapidamente. A recomendação é manter Inter, mas definir uma escala semântica curta e previsível, com peso máximo normalmente em 700 e uso pontual de 800 apenas para números ou títulos de destaque.

Os botões também precisam de uma linguagem única. Há ações primárias com `py-4`, ações de ícone com `p-1` e controles que parecem botões mas são `div` clicáveis. O seletor de membro da tabela, por exemplo, funciona como interação, mas não expõe um elemento nativamente focável; os controles de editar, excluir e confirmar presença aparecem com áreas muito pequenas em algumas densidades. Isso deve ser corrigido sem tornar a tabela desktop excessivamente espaçada.

A base mobile já usa uma navegação inferior fixa e uma folha inferior para selecionar membros. O principal risco é a tabela continuar sendo o modelo mental dominante em telas estreitas. No celular, a prioridade deve ser a tarefa: consultar minha escala, confirmar disponibilidade, aceitar ou recusar uma solicitação, pedir substituição e resolver uma lacuna. A edição densa da grade deve continuar disponível, mas ser apoiada por uma visão em cards e por um drawer de edição.

O build atual também sinaliza chunks JavaScript acima de 500 kB. Isso não bloqueia a entrega, mas é uma oportunidade importante para um app web mobile: dividir telas administrativas e recursos pesados por rota, mantendo o primeiro carregamento concentrado em autenticação, dashboard e escala pessoal.

## Direção de produto

A proposta é posicionar o Ministral como **sistema de cobertura e cuidado de voluntários**, não apenas como uma planilha digital. O diferencial pode ser unir a escala operacional com equilíbrio de carga, disponibilidade, conflitos entre ministérios, comunicação contextual e acompanhamento de presença. Plataformas de referência como Planning Center destacam a integração de escalas, planos de culto, comunicação e participação em um mesmo ecossistema [1]. Ministry Scheduler Pro comunica geração automática de escalas equilibradas, lembretes, substituições online e app móvel [2]. TouchPoint destaca lacunas de cobertura, inscrições online, substituições, recorrência, prevenção de conflitos, presença e permissões por liderança [3].

> O Ministral deve responder a uma pergunta central: “Quem precisa servir, onde existe risco de cobertura e qual é a próxima ação mais simples para resolver isso?”

Essa direção dá ao produto uma proposta clara para igrejas com alta demanda de gerenciamento: reduzir o tempo do líder, diminuir faltas e conflitos, distribuir o serviço de forma mais justa e oferecer ao voluntário uma experiência que não pareça um painel administrativo.

## Escopo recomendado por prioridade

| Prioridade | Evolução | Benefício principal | Critério de sucesso |
|---|---|---|---|
| P0 | Fundação tipográfica e sistema de botões | Coerência e leitura | Todas as telas usam tokens semânticos e botões com estados consistentes |
| P0 | First mobile para navegação, dashboard e escala pessoal | Uso diário mais rápido | As tarefas principais funcionam confortavelmente com uma mão em telas estreitas |
| P0 | Substituição e confirmação de escala | Menos faltas e mensagens paralelas | Um voluntário resolve sua indisponibilidade sem depender do líder para toda a operação |
| P1 | Motor de geração equilibrada | Economia de tempo e redução de burnout | O líder gera uma escala com regras de disponibilidade, frequência e conflitos |
| P1 | Central de pendências | Priorização operacional | O líder vê lacunas, conflitos, respostas pendentes e confirmações em uma fila única |
| P1 | Comunicação contextual | Maior taxa de resposta | Convites, lembretes e alterações são enviados no contexto da escala e registram o status |
| P1 | Permissões por organização, ministério e função | Segurança e delegação | Líderes conseguem operar seu ministério sem acesso indevido ao restante |
| P2 | Presença, histórico e indicadores de saúde | Gestão baseada em evidências | O sistema mostra cobertura, faltas, substituições, carga por pessoa e tendência mensal |
| P2 | Integrações | Menos trabalho duplicado | Calendários, notificações e canais externos podem sincronizar eventos e alterações |
| P2 | Internacionalização e regionalização | Produto global | Idioma, fuso, locale, formatos de data/hora e preferências de notificação são configuráveis |

## Melhorias imediatas de tipografia

A recomendação não é trocar a fonte, mas reduzir a improvisação. A escala abaixo mantém a personalidade atual, melhora a leitura em celular e deixa os títulos menos comprimidos.

| Token | Uso | Tamanho mobile | Peso | Altura de linha |
|---|---|---:|---:|---:|
| `display` | Título de entrada ou hero | 2rem | 800 | 1.05 |
| `heading-xl` | Título principal da tela | 1.5rem | 700 | 1.15 |
| `heading-lg` | Título de seção | 1.125rem | 700 | 1.25 |
| `body` | Texto de leitura e dados | 0.9375rem | 400–500 | 1.5 |
| `label` | Label de campo e metadado | 0.75rem | 600 | 1.3 |
| `caption` | Informação auxiliar | 0.6875rem | 500–600 | 1.35 |

Em especial, labels de formulário não devem depender sempre de caixa alta e `tracking-widest`. Caixa alta deve ficar reservada para pequenos metadados, status e categorias. Dados que o usuário precisa escanear, como nome, horário, ministério e situação de confirmação, devem usar caixa normal e contraste suficiente.

## Sistema de botões recomendado

A aplicação deve ter poucas variantes: `primary`, `secondary`, `ghost`, `danger`, `icon` e `link`. Cada variante precisa suportar `default`, `hover`, `focus-visible`, `pressed`, `disabled` e `loading`. O alvo visual mínimo deve ser de 44px de altura para ações principais; a WCAG 2.2 define 24 por 24 CSS pixels como requisito mínimo de tamanho ou espaçamento para alvos de ponteiro, e recomenda-se usar áreas maiores para controles importantes [4].

| Variante | Uso | Altura padrão | Regra de conteúdo |
|---|---|---:|---|
| `primary` | Salvar, publicar, confirmar | 44–48px | Um verbo claro e, quando útil, ícone à esquerda |
| `secondary` | Ação alternativa | 44–48px | Deve competir menos com a ação primária |
| `ghost` | Ações de apoio | 40–44px | Usar em barras e menus, sem parecer link quebrado |
| `danger` | Exclusão ou cancelamento destrutivo | 44–48px | Sempre explicitar o efeito |
| `icon` | Editar, fechar, avançar | 40–44px | Sempre com `aria-label` e tooltip quando necessário |
| `link` | Recuperação e navegação textual | 32px ou altura da linha | Não usar para ações críticas |

O foco deve permanecer visível e consistente. A WCAG 2.2 descreve um indicador de foco com mudança de contraste de pelo menos 3:1 e área perceptível [5]. Como o Ministral tem navegação fixa, drawers e menus sobrepostos, também é necessário garantir que o foco não fique completamente oculto por uma camada criada pela aplicação [6].

## Arquitetura first mobile

O celular deve ser tratado como o ambiente primário do voluntário, e não como uma versão reduzida da tela administrativa. A navegação inferior deve concentrar Início, Minha escala, Disponibilidade, Avisos e Menu. No desktop, a barra lateral pode expor a estrutura completa. O conteúdo deve reservar espaço para a barra fixa inferior e para `safe-area-inset-bottom`, evitando que botões fiquem cobertos por gestos do sistema.

A tabela de escala deve ter dois modos. No desktop, a grade continua sendo a ferramenta eficiente para o líder. No mobile, a mesma informação deve ser apresentada como cartões por evento, com data e horário em primeiro plano, seguida pelas funções e pelo estado de cada pessoa. Ao tocar em uma função, o usuário deve abrir uma folha de edição com pesquisa, disponibilidade, conflitos e ação de remover. A regra é preservar a capacidade, mas reduzir a carga cognitiva.

## Roadmap de 90 dias

| Período | Entrega | Resultado esperado |
|---|---|---|
| Semanas 1–2 | Tokens de tipografia, Button, IconButton, Field, Badge e estados de foco | Base visual previsível e redução de CSS local |
| Semanas 2–4 | Dashboard mobile, navegação, escala pessoal e empty/loading/error states | Uso diário rápido e compreensível |
| Semanas 5–6 | Solicitação de substituição, confirmação e fila de pendências | Menos intermediação do líder |
| Semanas 7–9 | Gerador de escala com regras de disponibilidade, frequência e conflito | Escalas mais rápidas e equilibradas |
| Semanas 10–12 | Comunicação contextual, analytics e permissões por ministério | Operação delegável e mensurável |

## Decisões que recomendo não adiar

A primeira decisão é separar claramente **escala pessoal** de **gestão da escala**. O voluntário deve abrir o app e encontrar sua próxima responsabilidade, seus pedidos pendentes e sua disponibilidade; o líder deve encontrar lacunas e riscos. A segunda decisão é assumir que conflitos e substituições são fluxos de primeira classe, não mensagens auxiliares. A terceira é criar uma camada de permissões por organização, ministério e papel, porque a expansão para igrejas maiores exigirá delegação com rastreabilidade.

A quarta decisão é preparar o produto para globalização desde o domínio, mesmo que a primeira entrega permaneça em português. Datas, horários, fuso, semana inicial, pluralização, idioma e canal de notificação não devem ficar embutidos na interface. A quinta é instrumentar métricas de produto: tempo para publicar uma escala, taxa de confirmação, tempo para preencher uma lacuna, quantidade de conflitos evitados, taxa de substituições resolvidas e distribuição de carga entre voluntários.

## Próxima implementação recomendada

Nesta etapa, a implementação mais segura e de maior retorno é criar a fundação global de tipografia e botões, corrigir alvos de toque e foco, melhorar o espaçamento da navegação mobile e adaptar os pontos críticos da escala para interação por toque. Essa base reduz inconsistência sem alterar o domínio da aplicação e prepara as telas para evoluções maiores, como substituições, automação e analytics.

## Referências

[1]: https://www.planningcenter.com/ "Planning Center — plataforma integrada para igrejas"

[2]: https://ministryschedulerpro.com/ "Ministry Scheduler Pro — programação e gestão de voluntários"

[3]: https://www.touchpointsoftware.com/features/church-volunteer-scheduling-software/ "TouchPoint — software de escalas e voluntários"

[4]: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html "W3C WCAG 2.2 — Target Size (Minimum)"

[5]: https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html "W3C WCAG 2.2 — Focus Appearance"

[6]: https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html "W3C WCAG 2.2 — Focus Not Obscured (Minimum)"

**Autor:** Manus AI
