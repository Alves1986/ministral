# Auditoria de separação de papéis — Ministral

**Data:** 2026-08-20
**Escopo:** usuário comum, administrador da organização/ministério e superadministrador global.

## Resumo executivo

O sistema já possui os campos `profiles.is_admin`, `profiles.is_super_admin`, `User.isOrgAdmin`, `User.isSuperAdmin` e `access_role`, além de um shell dedicado para o superadmin puro sem organização. Entretanto, a separação atual ainda é parcialmente visual e depende de condições amplas no `App.tsx`. Um superadmin vinculado a uma organização permanece no `DashboardLayout` comum e pode receber menus administrativos da organização. Além disso, o suporte usa consultas amplas e filtra a organização no cliente, o que não deve ser considerado isolamento seguro.

## Evidências encontradas

| Área | Situação atual | Risco ou impacto |
|---|---|---|
| Modelo de usuário | `access_role` aceita apenas `admin` ou `member`; os papéis globais ficam em flags adicionais | Permite combinações ambíguas e condicionais espalhadas |
| Sessão | `isOrgAdmin` vem de `profiles.is_admin`; `isSuperAdmin` vem de `profiles.is_super_admin` | A origem existe, mas não há uma matriz central de permissões |
| Shell global | Superadmin sem organização usa `SuperAdminLayout` | Caso especial funciona, mas não separa o superadmin vinculado a uma organização |
| Shell da organização | `isAdmin` é verdadeiro para admin de ministério, admin de organização ou superadmin | Mistura permissões de escopo local e global |
| Aba `super-admin` | Renderizada no shell comum quando `activeUser.isSuperAdmin` | Superadmin vinculado a organização pode acessar área global dentro do app comum |
| `support-admin` | Liberada para qualquer `isAdmin` | Admin de organização pode acessar o suporte, mas o serviço busca tickets de todas as organizações |
| Serviço de suporte | `fetchSupportTickets()` consulta todos os tickets e o componente filtra por organização | Isolamento depende do cliente; risco de exposição entre organizações |
| Escritas administrativas | Vários helpers de `admin.ts` fazem writes diretos e contam com RLS | O frontend não é uma barreira de segurança suficiente |
| SQL | Há políticas amplas para `is_super_admin()` | O banco protege o superadmin global, mas não há uma matriz equivalente para org-admin |
| Configuração de abas | `enabledTabs` controla disponibilidade de navegação | Configuração de UI não substitui autorização por papel |

## Matriz proposta

| Capacidade | Usuário comum | Admin da organização | Superadmin global |
|---|---:|---:|---:|
| Ver e confirmar a própria escala | Sim | Sim | Não como operação padrão |
| Informar disponibilidade e solicitar troca | Sim | Sim | Não como operação padrão |
| Ver escalas do ministério | Conforme acesso | Sim | Somente em modo de suporte/impersonação auditada |
| Criar e editar escalas do próprio ministério | Não | Sim, conforme ministérios autorizados | Não no shell local |
| Gerenciar membros do próprio escopo | Não | Sim | Global, em shell separado |
| Gerenciar regras e configurações do ministério | Não | Sim | Global somente quando necessário |
| Ver relatórios da organização | Não | Sim | Global agregado |
| Atender tickets da própria organização | Criar e acompanhar | Sim, somente a própria organização | Todos, no shell global |
| Gerenciar organizações, planos e quotas | Não | Não | Sim |
| Ver usuários globais e auditoria global | Não | Não | Sim |
| Fazer broadcast da plataforma | Não | Não | Sim |
| Alterar políticas ou dados de outra organização | Não | Não | Sim, com auditoria |

## Diretriz de implementação

A autorização deverá ser centralizada em contratos e helpers compartilhados, com três dimensões explícitas: `role` global, `organizationId` e `allowedMinistries`. A UI deverá ocultar e bloquear ações indevidas, mas toda operação de escrita e leitura sensível deverá continuar protegida por RLS/RPC no Supabase.

O superadmin deverá permanecer em um shell global separado. Se estiver associado a uma organização, isso não deverá conceder automaticamente as permissões de admin daquela organização nem misturar os menus. Qualquer acesso de suporte a uma organização deverá ser uma ação explícita, temporária e registrada.

## Ordem recomendada

1. Criar tipos e helpers centrais de papel e escopo.
2. Corrigir guards no `App.tsx` e no `DashboardLayout`.
3. Separar o menu de suporte global do suporte da organização.
4. Restringir o serviço de tickets por `organization_id` e revisar RLS.
5. Cobrir rotas, ações e consultas sensíveis com testes de permissão.
6. Só então adicionar o motor de conflitos e a central operacional para o admin.

## Implementação desta etapa

A separação foi centralizada em `utils/permissions.ts`, com os papéis `member`, `org_admin` e `super_admin`. O superadmin tem precedência e não herda o shell ou as abas da organização, mesmo quando possui `organizationId`. O administrador local precisa de escopo organizacional válido para acessar áreas administrativas.

O `App.tsx` agora filtra menus, valida abas abertas por URL e aplica um callback único para toda troca de aba. URLs inválidas retornam imediatamente ao dashboard ou ao shell global correto. O `DashboardLayout` deixou de exibir atalhos globais e identifica o papel local separadamente.

O suporte foi escopado no cliente por `organizationId` para administradores locais e por `isSuperAdmin` para o painel global. A migração `supabase/migrations/20260630_fix_support_tickets_rls.sql` já contém RLS para limitar leitura por organização e escrita administrativa, com exceção global baseada em `is_super_admin()`; essa política deve estar aplicada no projeto Supabase de produção.

Foram adicionados testes de permissão cobrindo superadmin, admin local, membro e ausência de escopo organizacional. As validações locais passaram: TypeScript, 25 testes, build de produção e `git diff --check`. O build mantém apenas o aviso conhecido de chunks grandes.

## Limite de segurança

Os guards de interface e os filtros de serviço reduzem exposição acidental, mas não substituem RLS/RPC. Antes de considerar a separação completa em produção, as políticas SQL devem ser aplicadas e verificadas no Supabase, especialmente nas tabelas de membros, escalas, anúncios, eventos e organizações.

## Avisos de segurança do Supabase — verificação de 2026-08-20

Após a migração de `support_tickets`, o advisor de segurança do projeto `gestaoescala` não apontou erro específico nessa tabela. Ele identificou, porém, riscos preexistentes fora do escopo imediato: `public.glory_transactions` possui políticas com RLS desativado e deve ser corrigida conforme [Policy Exists RLS Disabled](https://supabase.com/docs/guides/database/database-linter?lint=0007_policy_exists_rls_disabled) e [RLS Disabled in Public](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public); `whatsapp_pending_actions` tem RLS sem políticas; várias funções possuem `search_path` mutável; e funções `SECURITY DEFINER` como `check_trial_limits`, `cleanup_whatsapp_sent_log`, `create_org_ministry` e `get_my_org_id` aparecem executáveis pelo papel `anon`, conforme [Public Can Execute SECURITY DEFINER Function](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

Esses achados devem formar a próxima etapa de hardening do banco. Não foram alterados automaticamente nesta etapa para evitar impacto em faturamento, WhatsApp e criação de organizações sem mapear antes os consumidores legítimos dessas funções.
