# Upgrade mobile, tipografia e ações — Ministral

## Resultado

A etapa atual evoluiu o Ministral como aplicativo web first mobile sem alterar a paleta, o logotipo ou os arquivos de branding existentes. O foco foi transformar tipografia, ações e controles de toque em uma base previsível para o restante do sistema.

## Implementado

| Área | Resultado |
|---|---|
| Tipografia | Inter aplicada globalmente, melhor renderização de texto e tokens semânticos para título, seção, label e caption. |
| Botões | Novo `Button`/`IconButton` reutilizável com variantes primary, secondary, ghost, danger e link, estados de foco e loading, labels e alturas de toque. |
| Login | Ações de entrar, Google, recuperação, visibilidade de senha e links legais migrados para padrões consistentes. |
| Shell | Controles de navegação e sincronização com alvos maiores, tooltip/title e semântica acessível. |
| Escalas | Seleção de membro nativamente focável; editar, excluir, fechar e confirmar presença com alvos mais confortáveis no mobile. |
| Confirmação | Modal de presença migrado para botões compartilhados e layout de uma coluna no mobile. |
| Identidade | Cores e logo preservados; o logo verificado permanece em `/branding/logo-dark.png`. |

## Verificação

`npm run lint`, `npm run build`, `npx vitest run` e `git diff --check` passaram. Os testes concluíram com 4 arquivos e 21 testes aprovados. O build ainda informa um chunk acima de 500 kB, que deve ser tratado em uma etapa própria de code splitting e carregamento sob demanda.

A tela pública de login foi verificada no navegador com ambiente Supabase configurado. A medição no DOM confirmou fonte Inter, botões principais com 48px de altura e o botão de visibilidade da senha com 44 x 44px. O caminho do logotipo e a paleta visual atual permaneceram intactos.

## Proposta para competir no mercado

O posicionamento recomendado é transformar o Ministral em um sistema de **cobertura e cuidado de voluntários**, e não apenas uma tabela de escalas. O produto deve responder rapidamente quem precisa servir, onde existe risco de cobertura e qual é a próxima ação para resolver a situação.

| Prioridade | Próxima evolução | Por que importa |
|---|---|---|
| P0 | Separar claramente Minha escala e Gestão da escala | O voluntário precisa de simplicidade; o líder precisa de controle operacional. |
| P0 | Substituições, confirmações e central de pendências | Reduz faltas, mensagens paralelas e dependência do líder. |
| P1 | Gerador de escalas equilibrado por disponibilidade, frequência, função e conflitos | Economiza tempo e distribui a carga de servir com mais justiça. |
| P1 | Comunicação contextual com lembretes e status de resposta | Aumenta a taxa de confirmação e torna alterações rastreáveis. |
| P1 | Permissões por organização, ministério e função | Permite delegação segura para igrejas com alta demanda. |
| P2 | Presença, histórico, indicadores de cobertura e carga | Converte operação em decisões baseadas em evidências. |
| P2 | Integrações, internacionalização, fusos e preferências de notificação | Prepara o produto para uso global. |

A recomendação é não expandir funcionalidades antes de consolidar esses fluxos principais. A vantagem competitiva deve vir da combinação entre operação de escala, prevenção de conflitos, substituição rápida, equilíbrio de carga e experiência mobile simples.

## Branch

As alterações estão na branch `upgrade/ui-ux-global-2026-08-20` do repositório `Alves1986/ministral`. Commit desta etapa: `215c069ab6738f401aadad99e0d3ea5d58d52bf0`.

## Documentos relacionados

- `PRODUCT_UPGRADE_PROPOSAL.md`: proposta detalhada, roadmap de 90 dias e referências de mercado/acessibilidade.
- `MARKET_ACCESSIBILITY_RESEARCH.md`: síntese das soluções de referência e critérios WCAG aplicáveis.
- `UPGRADE_AUDIT.md`: histórico técnico, evidências de validação e limitações do ambiente.

**Autor:** Manus AI
