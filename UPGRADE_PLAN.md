# Plano de upgrade do Ministral

## Entendimento

O sistema precisa ficar mais claro, consistente e preparado para alta demanda de gerenciamento de escalas. O upgrade será incremental: preservará os valores cromáticos e os ativos de branding, manterá os IDs de navegação e os contratos de dados, e concentrará o ganho em hierarquia, densidade, estados de interação, acessibilidade e comportamento responsivo.

## Critérios de sucesso

| Área | Critério verificável |
| --- | --- |
| Identidade | Nenhum arquivo de `public/branding/` alterado e nenhum token de cor existente substituído. |
| Navegação | Menus preservam os IDs atuais, ficam mais legíveis e oferecem nome/estado acessível no desktop e no mobile. |
| Responsividade | O shell mantém navegação útil em telas pequenas, respeita safe areas e não sobrepõe o conteúdo principal. |
| Acessibilidade | Foco visível, `aria-current`, `aria-expanded`, rótulos de botões e região de conteúdo principal identificada. |
| Qualidade | Build concluído e `tsc --noEmit` sem os dois erros identificados no baseline. |
| Performance | Não introduzir dependências; reduzir alterações ao shell e aplicar estilos sem novas imagens ou fontes externas. |

## Arquivos previstos

| Arquivo | Alteração prevista |
| --- | --- |
| `components/DashboardLayout.tsx` | Refinar shell, navegação, cabeçalhos, tooltips do menu colapsado, estados acessíveis e comportamento mobile. |
| `index.css` | Adicionar tokens semânticos não cromáticos, foco visível, scrollbar e utilitários de transição/responsividade sem trocar a paleta. |
| `components/SettingsScreen.tsx` | Corrigir import ausente de `AlertCircle`. |
| `App.tsx` | Corrigir a chamada de diretrizes para respeitar a assinatura do serviço. |
| `UPGRADE_AUDIT.md` | Registrar baseline, decisões e evidências. |
| `UPGRADE_PLAN.md` | Registrar o plano e os critérios de aceite. |

## Fora do escopo nesta iteração

Não serão alterados o logotipo, arquivos de branding, esquema de cores, chave de escala `ruleId|date|role`, regras de segurança, contratos de integração ou deploy. Também não serão adicionadas novas funcionalidades de negócio sem evidência de que são necessárias para a experiência global.
