# Roteiro de Resposta a Incidentes de Segurança e Vazamento de Dados (LGPD)

**Base Legal:** Art. 48 da Lei Geral de Proteção de Dados (Lei nº 13.709/2018) e Resolução CD/ANPD nº 15/2024 (Regulamento de Comunicação de Incidente de Segurança).

---

## 1. Prazo Legal Obrigatório: 3 (três) Dias Úteis

Caso ocorra qualquer incidente de segurança (acesso não autorizado, vazamento, perda, alteração ou destruição acidental/ilícita de dados pessoais) que possa acarretar **risco ou dano relevante** aos titulares:

- **Prazo para comunicar à ANPD:** **Até 3 (três) dias úteis** contados do conhecimento do incidente (Resolução CD/ANPD nº 15/2024, art. 6º).
- **Prazo para comunicar aos Titulares Afetados:** **Até 3 (três) dias úteis** contados do conhecimento do incidente, de forma direta e individualizada (e-mail/WhatsApp) e em linguagem simples.
- **Prazo para complementar informações (se preliminar):** Até **20 (vinte) dias úteis** a partir da comunicação inicial.

---

## 2. Equipe de Resposta e Contatos

- **Controlador / Operador da Plataforma:** Ministral (`VITE_COMPANY_NAME` / `VITE_COMPANY_CNPJ`)
- **Encarregado pelo Tratamento de Dados (DPO):** `VITE_DPO_EMAIL` (fallback: `contato.ministral@gmail.com`)
- **Canal Oficial da ANPD:** Sistema eletrônico SEI/ANPD — [https://www.gov.br/anpd/pt-br/canais_atendimento/sei](https://www.gov.br/anpd/pt-br/canais_atendimento/sei)

---

## 3. Passo a Passo de Ação Imediata (0h às 72h úteis)

### Fase 1: Contenção e Preservação de Evidências (Horas 0 a 4)
1. **Isolar o vetor do incidente:**
   - Revogar chaves comprometidas no painel do Supabase (`Settings -> API -> Rotate anon/service_role`), Vercel (`Environment Variables`) ou provedores de IA (`GEMINI_API_KEY`, `OPENROUTER_API_KEY`).
   - Suspender sessões ativas suspeitas em `auth.sessions` e tokens de convite (`invite_tokens`).
2. **Preservar logs forenses:**
   - Exportar logs do Supabase (`postgres_logs`, `auth_logs`, `edge_logs`), `ministry_audit_logs` e `ai_usage_logs` antes que rotacionem.
   - Nunca sobrescrever registros de auditoria.

### Fase 2: Avaliação de Risco e Impacto (Horas 4 a 24)
Avaliar se há risco ou dano relevante (Res. CD/ANPD nº 15/2024, art. 5º):
- Envolve dados sensíveis (ex.: convicção religiosa vinculada a membros de igrejas, dados de crianças/adolescentes)?
- Envolve credenciais de autenticação (hashes/tokens) ou dados financeiros (assinaturas Asaas/Stripe)?
- Qual o volume de titulares e organizações afetadas?

### Fase 3: Notificação à ANPD e aos Titulares (Até 3 Dias Úteis)
1. **Comunicação à ANPD (via peticionamento eletrônico):**
   - Descrição da natureza e categoria dos dados pessoais afetados;
   - Número estimado de titulares afetados (incluindo discriminação de crianças/adolescentes ou idosos, se houver);
   - Medidas técnicas e de segurança utilizadas para a proteção dos dados (RLS no PostgreSQL, TLS 1.3, criptografia em repouso, hashing bcrypt no Supabase Auth);
   - Riscos relacionados ao incidente e impactos potenciais;
   - Motivos da demora, no caso de a comunicação não ter sido feita no prazo de 3 dias úteis;
   - Medidas que foram ou que serão adotadas para reverter ou mitigar os efeitos do prejuízo.

2. **Comunicação aos Titulares e Organizações (Igrejas/Ministérios):**
   - Enviar comunicado em linguagem clara contendo:
     - Data do incidente e resumo do ocorrido;
     - Quais dados foram afetados (ex.: nome, e-mail, WhatsApp, escalas);
     - Recomendações práticas para o titular (ex.: redefinição imediata de senha, alerta contra phishing);
     - Canal direto de atendimento com o Encarregado (DPO): `contato.ministral@gmail.com`.

### Fase 4: Registro Interno Obrigatório (5 Anos)
- Manter o registro formal de **todo** incidente de segurança (mesmo os que não gerarem comunicação à ANPD) pelo prazo mínimo de **5 (cinco) anos** (Resolução CD/ANPD nº 15/2024, art. 10), contendo data, descrição, dados atingidos, avaliação de risco e medidas corretivas.
