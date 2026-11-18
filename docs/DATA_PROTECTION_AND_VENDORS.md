# Conformidade LGPD: Mapa de Operadores (DPA), Retenção de Dados, SDKs e Licenças

**Documento Técnico-Jurídico — Sistema Ministral**

---

## 1. Mapa de Fornecedores e Suboperadores de Dados (Item 22 e 23 — DPA / ANPD)

Abaixo estão listados todos os operadores e suboperadores que tratam dados pessoais em nome da plataforma Ministral para fins de formalização de Contratos de Processamento de Dados (*Data Processing Agreements — DPA*) e transparência na Política de Privacidade:

| Operador / Fornecedor | Papel no Tratamento | Dados Pessoais Compartilhados | Finalidade | Localização / Transferência Internacional |
|---|---|---|---|---|
| **Supabase Inc.** | Infraestrutura de Banco de Dados, Auth, Storage e Edge Functions | Nome, e-mail, hash de senha, telefone/WhatsApp, data de nascimento, fotos de perfil, escalas, áudios de chat, logs de consentimento | Autenticação, armazenamento seguro (RLS) e execução de regras de negócio | EUA / AWS (Cláusulas-Padrão / DPA Supabase) |
| **Vercel Inc.** | Hospedagem Web e Serverless API | Endereço IP, cabeçalhos HTTP, logs de requisição | Entrega da aplicação web/PWA e roteamento de API | Global / EUA (DPA Vercel) |
| **Asaas Gestão Financeira Instituição de Pagamento S.A.** | Gateway de Pagamento Oficial (Brasil) | Nome do responsável/organização, e-mail, CPF/CNPJ, telefone e dados de cobrança (PIX, boleto, cartão) | Processamento de assinaturas dos planos Pro e Enterprise | Brasil |
| **Stripe Brasil Soluções de Pagamento Ltda. / Stripe Inc.** | Gateway de Pagamento Secundário | Nome, e-mail, identificadores de cliente/assinatura e dados de pagamento | Processamento de assinaturas e portal do cliente | Brasil / EUA (DPA Stripe) |
| **Google LLC (Google Cloud / OAuth / Calendar / Gemini / YouTube)** | Autenticação OAuth, Sincronização de Agenda, IA Generativa (Gemini) e API de Vídeo | Nome, e-mail e foto (OAuth); eventos de escala (Calendar); nomes/funções na escala quando acionada a IA (caso não haja opt-out) | Login social, exportação de agenda, sugestões inteligentes de escala e busca de repertório | EUA / Global (Google Cloud Data Processing Addendum) |
| **OpenRouter Inc.** | Roteador de Modelos de IA (Opcional) | Contexto de escala e nomes/funções de membros (apenas quando selecionado pelo administrador e sem opt-out) | Geração opcional de sugestões e avisos por IA | EUA |

---

## 2. Tabela de Retenção e Expurgo de Dados (Item 28 — LGPD art. 15 e 16)

| Categoria de Dado | Tabela / Armazenamento | Prazo de Retenção | Regra de Expurgo / Exclusão | Base Legal (LGPD) |
|---|---|---|---|---|
| **Dados de Perfil e Membro** (nome, e-mail, WhatsApp, nascimento, foto) | `profiles`, `ministry_members`, bucket `avatars` | Enquanto a conta estiver ativa | Exclusão imediata mediante solicitação do titular no painel (`Meu Perfil -> Excluir Minha Conta`) ou até 30 dias após encerramento da organização | Execução de contrato / Consentimento (Art. 7º, I e V) |
| **Registro de Prova de Consentimento e Termos** | `profiles.user_metadata`, `consent_logs` | Durante o uso + **5 anos** após encerramento da conta | Mantido de forma minimizada para ônus da prova legal (Art. 8º, § 2º da LGPD e prescrição civil) | Cumprimento de obrigação legal / Exercício regular de direitos (Art. 7º, II e VI) |
| **Escalas, Indisponibilidades e Trocas** | `schedule_assignments`, `availability`, `swap_requests` | Até **24 meses** após o evento ou até exclusão da conta/organização | Anonimização ou exclusão automática ao remover membro/organização (`ON DELETE CASCADE`) | Execução de contrato (Art. 7º, V) |
| **Mensagens e Áudios de Chat do Evento** | `event_messages`, bucket `chat_audio` | Até **180 dias** após a realização do evento | Expurgo periódico de eventos passados ou exclusão imediata pelo titular/admin | Legítimo interesse / Execução de contrato (Art. 7º, V e IX) |
| **Comunicados / Avisos do Mural** | `announcements` | Até a data de expiração (`expiration_date`) configurada no aviso | Ocultação imediata após `expiration_date` e limpeza periódica | Execução de contrato (Art. 7º, V) |
| **Logs de Acesso e Auditoria de Segurança** | `ministry_audit_logs`, `ai_usage_logs`, logs de aplicação | Mínimo de **6 meses** (Marco Civil da Internet, Lei 12.965/2014, art. 15) e até **5 anos** para incidentes (Res. ANPD 15/2024) | Expurgo automático após o prazo legal | Obrigação legal (Art. 7º, II) |
| **Registros de Cobrança e Faturamento** | `organizations` (IDs Asaas/Stripe) e documentos fiscais | **5 anos** (Código Tributário Nacional, art. 173) | Exclusão após prescrição tributária | Obrigação legal (Art. 7º, II) |

---

## 3. Auditoria de SDKs, Analytics e Licenças Open Source (Itens 8, 21 e 31)

1. **Remoção de SDKs Não Utilizados (Item 8):**
   - Os pacotes `firebase`, `vagalume` e `querystring-es3` não eram utilizados em tempo de execução e foram removidos do `package.json` para reduzir a superfície de coleta de dados e dependências de terceiros.
   - O sistema **não** carrega rastreadores publicitários de terceiros (Meta Pixel, Google Ads, Hotjar ou Google Analytics) por padrão. Apenas armazenamento local estritamente necessário (`localStorage` para sessão Supabase, tema visual e preferências de consentimento) é utilizado.
2. **Auditoria de Licenças Open Source (Item 21):**
   - Todas as dependências diretas e de desenvolvimento (`react`, `vite`, `@supabase/supabase-js`, `lucide-react`, `jspdf`, `dompurify`, `express`, `zustand`, `tailwindcss`) utilizam licenças permissivas (**MIT**, **Apache-2.0**, **ISC** ou **MPL-2.0**).
   - **Nenhuma** dependência possui licença copyleft restritiva (**GPL** ou **AGPL**).
3. **Direitos de Uso de Imagens, Fontes e Ícones (Item 31):**
   - Fonte tipográfica: **Inter** (Google Fonts — licença aberta *SIL Open Font License 1.1*, uso comercial permitido).
   - Ícones: **Lucide Icons** (`lucide-react` — licença *ISC*, uso comercial permitido).
   - Logotipos e mockups em `public/branding` e `Ministral Page/assets`: ativos próprios da plataforma Ministral e uploads autorizados pelas organizações clientes.
