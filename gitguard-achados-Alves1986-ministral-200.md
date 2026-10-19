# Relatório de Segurança — Alves1986/ministral

**Scan:** `cmupk2ywz015vhcdmgg12f829` · MANUAL · branch `main` · commit `986a22bdc311`
**Status:** COMPLETED · **Executado em:** 2026-10-01T13:15:02.054Z · **Concluído em:** 2026-10-01T13:20:18.891Z
**Relatório gerado em:** 2026-10-01T13:21:07.288Z por GitGuard

## Instruções para a IA que for corrigir isto

- Esta é uma seleção de 200 achado(s) escolhidos à mão, não o scan completo do repositório. Não presuma que é a lista inteira de problemas.
- Repositório alvo: Alves1986/ministral, branch "main", commit 986a22bdc3119f04908f6ba928070e414c651e56. Aplique as correções diretamente nesse checkout.
- Em "dependencyUpgrades", cada entrada agrupa TODOS os CVEs de um mesmo pacote — faça UM upgrade por pacote (para "recommendedVersion" ou mais recente), não uma correção por CVE.
- Em "secrets", nunca tente adivinhar ou reconstruir o valor original do segredo (ele foi propositalmente redigido) — apenas remova/rotacione conforme "remediation".
- Depois de aplicar as correções, rode os testes existentes do projeto e, se disponível, o linter/build antes de considerar concluído.

## Resumo

- **Total de findings:** 200
- **Por severidade:** CRITICAL: 10 · HIGH: 88 · MEDIUM: 85 · LOW: 17
- **Por scanner:** TRIVY: 184 · GITLEAKS: 2 · SEMGREP: 14

## Dependências para atualizar

### 📦 `jspdf` (24 CVEs) — severidade máxima: CRITICAL

**Ação recomendada:** atualizar de `2.5.2` para `4.2.1` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| CRITICAL | CVE-2025-68428 | jspdf: jsPDF Local File Inclusion/Path Traversal vulnerability | 4.0.0 |
| CRITICAL | CVE-2026-31938 | jspdf: jsPDF: Cross site scripting via unsanitized output options | 4.2.1 |
| CRITICAL | CVE-2025-68428 | jspdf: jsPDF Local File Inclusion/Path Traversal vulnerability | 4.0.0 |
| CRITICAL | CVE-2026-31938 | jspdf: jsPDF: Cross site scripting via unsanitized output options | 4.2.1 |
| HIGH | CVE-2025-29907 | jsPDF Bypass Regular Expression Denial of Service (ReDoS) | 3.0.1 |
| HIGH | CVE-2026-31898 | jspdf: jsPDF: Arbitrary code execution via unsanitized input in createAnnotation method | 4.2.1 |
| HIGH | CVE-2026-25940 | jsPDF: PDF injection in AcroForm module allows arbitrary JavaScript execution (RadioButton children) | 4.2.0 |
| HIGH | CVE-2026-25755 | jsPDF: PDF object injection via unsanitized input in addJS method | 4.2.0 |
| HIGH | CVE-2026-25535 | jsPDF: denial of service via malicious GIF dimensions | 4.2.0 |
| HIGH | CVE-2026-24737 | jsPDF: jsPDF: Arbitrary code execution via unsanitized input in Acroform module | 4.1.0 |
| HIGH | CVE-2026-24133 | jsPDF: jsPDF: Denial of Service due to excessive memory allocation from crafted BMP images | 4.1.0 |
| HIGH | CVE-2025-57810 | jspdf: jsPDF Denial of Service (DoS) | 3.0.2 |
| HIGH | CVE-2025-29907 | jsPDF Bypass Regular Expression Denial of Service (ReDoS) | 3.0.1 |
| HIGH | CVE-2026-31898 | jspdf: jsPDF: Arbitrary code execution via unsanitized input in createAnnotation method | 4.2.1 |
| HIGH | CVE-2026-25940 | jsPDF: PDF injection in AcroForm module allows arbitrary JavaScript execution (RadioButton children) | 4.2.0 |
| HIGH | CVE-2026-25755 | jsPDF: PDF object injection via unsanitized input in addJS method | 4.2.0 |
| HIGH | CVE-2026-25535 | jsPDF: denial of service via malicious GIF dimensions | 4.2.0 |
| HIGH | CVE-2026-24737 | jsPDF: jsPDF: Arbitrary code execution via unsanitized input in Acroform module | 4.1.0 |
| HIGH | CVE-2026-24133 | jsPDF: jsPDF: Denial of Service due to excessive memory allocation from crafted BMP images | 4.1.0 |
| HIGH | CVE-2025-57810 | jspdf: jsPDF Denial of Service (DoS) | 3.0.2 |
| MEDIUM | CVE-2026-24040 | jsPDF: jsPDF: Cross-User Data Leakage via race condition in addJS method | 4.1.0 |
| MEDIUM | CVE-2026-24043 | jsPDF: jsPDF: PDF integrity compromised via arbitrary XML injection in addMetadata function | 4.1.0 |
| MEDIUM | CVE-2026-24040 | jsPDF: jsPDF: Cross-User Data Leakage via race condition in addJS method | 4.1.0 |
| MEDIUM | CVE-2026-24043 | jsPDF: jsPDF: PDF integrity compromised via arbitrary XML injection in addMetadata function | 4.1.0 |

### 📦 `websocket-driver` (4 CVEs) — severidade máxima: CRITICAL

**Ação recomendada:** atualizar de `0.7.4` para `0.7.5` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| CRITICAL | CVE-2026-54466 | websocket-driver is a WebSocket protocol handler with pluggable I/O. P ... | 0.7.5 |
| CRITICAL | CVE-2026-54466 | websocket-driver is a WebSocket protocol handler with pluggable I/O. P ... | 0.7.5 |
| MEDIUM | CVE-2026-54490 | websocket-driver is a WebSocket protocol handler with pluggable I/O. P ... | 0.7.5 |
| MEDIUM | CVE-2026-54490 | websocket-driver is a WebSocket protocol handler with pluggable I/O. P ... | 0.7.5 |

### 📦 `babel-traverse` (2 CVEs) — severidade máxima: CRITICAL

**Ação recomendada:** atualizar de `6.26.0` para `7.23.2` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| CRITICAL | CVE-2023-45133 | babel: arbitrary code execution | 7.23.2 |
| CRITICAL | CVE-2023-45133 | babel: arbitrary code execution | 7.23.2 |

### 📦 `fast-xml-parser` (10 CVEs) — severidade máxima: CRITICAL

**Ação recomendada:** atualizar de `5.2.5` para `5.7.0` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| CRITICAL | CVE-2026-25896 | fast-xml-parser: fast-xml-parser: Cross-Site Scripting (XSS) due to improper DOCTYPE entity handling | 5.3.5, 4.5.4 |
| CRITICAL | CVE-2026-25896 | fast-xml-parser: fast-xml-parser: Cross-Site Scripting (XSS) due to improper DOCTYPE entity handling | 5.3.5, 4.5.4 |
| HIGH | CVE-2026-33036 | fast-xml-parser: fast-xml-parser: Denial of Service via XML entity expansion bypass | 5.5.6, 4.5.5 |
| HIGH | CVE-2026-26278 | fast-xml-parser: fast-xml-parser: Denial of Service via unlimited XML entity expansion | 4.5.4, 5.3.6 |
| HIGH | CVE-2026-25128 | fast-xml-parser: fast-xml-parser has RangeError DoS Numeric Entities Bug | 5.3.4 |
| HIGH | CVE-2026-33036 | fast-xml-parser: fast-xml-parser: Denial of Service via XML entity expansion bypass | 5.5.6, 4.5.5 |
| HIGH | CVE-2026-26278 | fast-xml-parser: fast-xml-parser: Denial of Service via unlimited XML entity expansion | 4.5.4, 5.3.6 |
| HIGH | CVE-2026-25128 | fast-xml-parser: fast-xml-parser has RangeError DoS Numeric Entities Bug | 5.3.4 |
| MEDIUM | CVE-2026-33349 | fast-xml-parser: fast-xml-parser: Denial of Service via unbounded entity expansion due to incorrect configuration limit handling | 4.5.5, 5.5.7 |
| MEDIUM | CVE-2026-41650 | fast-xml-parser: fast-xml-parser: XML injection via improper escaping of comment and CDATA sequences | 5.7.0 |

### 📦 `json5` (1 CVE) — severidade máxima: HIGH

**Ação recomendada:** atualizar de `0.5.1` para `2.2.2, 1.0.2` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| HIGH | CVE-2022-46175 | json5: Prototype Pollution in JSON5 via Parse Method | 2.2.2, 1.0.2 |

### 📦 `browserslist` (4 CVEs) — severidade máxima: HIGH

**Ação recomendada:** atualizar de `3.2.8` para `4.28.7` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| HIGH | CVE-2026-73089 | browserslist: Browserslist: Denial of Service via unbounded memory growth from distinct query results | 4.28.7 |
| HIGH | CVE-2026-73088 | browserslist: Browserslist: Prototype pollution leading to denial of service | 4.28.7 |
| HIGH | CVE-2026-73089 | browserslist: Browserslist: Denial of Service via unbounded memory growth from distinct query results | 4.28.7 |
| HIGH | CVE-2026-73088 | browserslist: Browserslist: Prototype pollution leading to denial of service | 4.28.7 |

### 📦 `braces` (1 CVE) — severidade máxima: HIGH

**Ação recomendada:** atualizar de `1.8.5` para `3.0.3` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| HIGH | CVE-2024-4068 | braces: fails to limit the number of characters it can handle | 3.0.3 |

### 📦 `brace-expansion` (7 CVEs) — severidade máxima: HIGH

**Ação recomendada:** atualizar de `1.1.15` para `5.0.8, 3.0.3, 2.1.3, 1.1.17` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| HIGH | CVE-2026-69152 | brace-expansion: DoS via unbounded intermediate arrays, bypassing the CVE-2026-14257 mitigation | 1.1.18, 2.1.4, 3.0.6, 5.0.9 |
| HIGH | CVE-2026-14257 | brace-expansion: Brace-expansion: Denial of Service via memory exhaustion in expand() function | 5.0.8, 3.0.3, 2.1.3, 1.1.17 |
| HIGH | CVE-2026-13149 | brace-expansion: Brace-expansion: Denial of Service due to exponential-time complexity | 5.0.7, 1.1.16, 2.1.2 |
| HIGH | CVE-2026-69152 | brace-expansion: DoS via unbounded intermediate arrays, bypassing the CVE-2026-14257 mitigation | 1.1.18, 2.1.4, 3.0.6, 5.0.9 |
| HIGH | CVE-2026-14257 | brace-expansion: Brace-expansion: Denial of Service via memory exhaustion in expand() function | 5.0.8, 3.0.3, 2.1.3, 1.1.17 |
| HIGH | CVE-2026-13149 | brace-expansion: Brace-expansion: Denial of Service due to exponential-time complexity | 5.0.7, 1.1.16, 2.1.2 |
| MEDIUM | CVE-2026-45149 | brace-expansion: brace-expansion: Denial of Service due to excessive memory allocation when expanding large numeric ranges | 5.0.6 |

### 📦 `@grpc/grpc-js` (4 CVEs) — severidade máxima: HIGH

**Ação recomendada:** atualizar de `1.9.15` para `1.9.16, 1.10.12, 1.11.4, 1.12.7, 1.13.5, 1.14.4` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| HIGH | CVE-2026-48069 | grpc-js: @grpc/grpc-js: Client or server crash via malformed compressed message | 1.9.16, 1.10.12, 1.11.4, 1.12.7, 1.13.5, 1.14.4 |
| HIGH | CVE-2026-48068 | grpc-js: @grpc/grpc-js: Server crash via malformed HTTP/2 stream initiation | 1.9.16, 1.10.12, 1.11.4, 1.12.7, 1.13.5, 1.14.4 |
| HIGH | CVE-2026-48069 | grpc-js: @grpc/grpc-js: Client or server crash via malformed compressed message | 1.9.16, 1.10.12, 1.11.4, 1.12.7, 1.13.5, 1.14.4 |
| HIGH | CVE-2026-48068 | grpc-js: @grpc/grpc-js: Server crash via malformed HTTP/2 stream initiation | 1.9.16, 1.10.12, 1.11.4, 1.12.7, 1.13.5, 1.14.4 |

### 📦 `ws` (4 CVEs) — severidade máxima: HIGH

**Ação recomendada:** atualizar de `8.20.0` para `8.20.1` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| HIGH | CVE-2026-48779 | ws: ws: Denial of Service via memory exhaustion from small WebSocket fragments | 5.2.5, 6.2.4, 7.5.11, 8.21.0 |
| HIGH | CVE-2026-48779 | ws: ws: Denial of Service via memory exhaustion from small WebSocket fragments | 5.2.5, 6.2.4, 7.5.11, 8.21.0 |
| MEDIUM | CVE-2026-45736 | ws: ws: Uninitialized memory disclosure via `websocket.close()` with `TypedArray` | 8.20.1 |
| MEDIUM | CVE-2026-45736 | ws: ws: Uninitialized memory disclosure via `websocket.close()` with `TypedArray` | 8.20.1 |

### 📦 `protobufjs` (6 CVEs) — severidade máxima: HIGH

**Ação recomendada:** atualizar de `7.6.0` para `7.6.5, 8.6.6` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| HIGH | CVE-2026-48712 | protobufjs: protobufjs: Denial of Service via uncontrolled recursion with crafted protobuf payload | 7.6.1, 8.4.1 |
| HIGH | CVE-2026-48712 | protobufjs: protobufjs: Denial of Service via uncontrolled recursion with crafted protobuf payload | 7.6.1, 8.4.1 |
| MEDIUM | CVE-2026-54269 | protobufjs: protobufjs-cli: protobufjs: Denial of Service due to name collision with runtime helpers | 7.6.3, 8.6.0 |
| MEDIUM | CVE-2026-59877 | protobufjs: protobufjs: Denial of Service via crafted .proto schema | 7.6.5, 8.6.6 |
| MEDIUM | CVE-2026-54269 | protobufjs: protobufjs-cli: protobufjs: Denial of Service due to name collision with runtime helpers | 7.6.3, 8.6.0 |
| MEDIUM | CVE-2026-59877 | protobufjs: protobufjs: Denial of Service via crafted .proto schema | 7.6.5, 8.6.6 |

### 📦 `@xmldom/xmldom` (11 CVEs) — severidade máxima: HIGH

**Ação recomendada:** atualizar de `0.9.11` para `0.9.12` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| HIGH | CVE-2026-83608 | xmldom: @xmldom/xmldom: xmldom: XML Markup Injection via DocType Name Bypass | 0.8.15, 0.9.12 |
| HIGH | CVE-2026-83618 | xmldom: @xmldom/xmldom: xmldom: DocumentType injection bypass via embedded line terminators | 0.9.12 |
| HIGH | CVE-2026-83617 | @xmldom/xmldom: xmldom: XML injection via embedded line terminator in element/attribute names | 0.9.12 |
| HIGH | CVE-2026-83616 | xmldom: xmldom: XML Structure Injection via Unvalidated Processing Instruction Targets | 0.8.15, 0.9.12 |
| HIGH | CVE-2026-83615 | xmldom: @xmldom/xmldom: xmldom: Denial of Service via quadratic memory consumption | 0.8.15, 0.9.12 |
| HIGH | CVE-2026-83614 | xmldom: @xmldom/xmldom: xmldom: Denial of Service via quadratic-time XML parsing | 0.8.15, 0.9.12 |
| HIGH | CVE-2026-83613 | xmldom: @xmldom/xmldom: xmldom: Denial of Service due to quadratic-time attribute processing | 0.8.15, 0.9.12 |
| HIGH | CVE-2026-83612 | xmldom: xmldom: Denial of Service via crafted HTML with mixed-case tags | 0.9.12 |
| HIGH | CVE-2026-83609 | @xmldom/xmldom: xmldom: Markup injection via embedded line terminators in XML names | 0.9.12 |
| MEDIUM | CVE-2026-83610 | xmldom: @xmldom/xmldom: xmldom: XML fragment injection via invalid EntityReference serialization | 0.8.15, 0.9.12 |
| MEDIUM | CVE-2026-83611 | xmldom: xmldom: Malformed XML end tag parsing leads to content discard and security bypass | 0.8.15, 0.9.12 |

### 📦 `lodash-es` (4 CVEs) — severidade máxima: HIGH

**Ação recomendada:** atualizar de `4.17.21` para `4.18.0` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| HIGH | CVE-2026-4800 | lodash: lodash: Arbitrary code execution via untrusted input in template imports | 4.18.0 |
| HIGH | CVE-2026-4800 | lodash: lodash: Arbitrary code execution via untrusted input in template imports | 4.18.0 |
| MEDIUM | CVE-2026-2950 | lodash: Lodash: Prototype pollution allows deletion of built-in prototype properties via array path bypass | 4.18.0 |
| MEDIUM | CVE-2025-13465 | lodash: prototype pollution in _.unset and _.omit functions | 4.17.23 |

### 📦 `axios` (22 CVEs) — severidade máxima: HIGH

**Ação recomendada:** atualizar de `1.12.2` para `1.16.0` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| HIGH | CVE-2026-44486 | axios: Axios: Information disclosure of proxy credentials via HTTP redirects | 1.16.0, 0.32.0 |
| HIGH | CVE-2026-44487 | axios: Axios: Information disclosure of proxy credentials via redirect flows | 1.16.0, 0.32.0 |
| HIGH | CVE-2026-44496 | axios: Axios: Client-side Denial of Service via unescaped regex metacharacters in XSRF cookie name | 1.16.0, 0.32.0 |
| HIGH | CVE-2026-44495 | axios: Axios: Information disclosure due to prototype pollution vulnerability | 1.15.2, 0.31.1 |
| HIGH | CVE-2026-44494 | axios: Axios: Man-in-the-Middle (MITM) attack via Prototype Pollution | 1.16.0 |
| HIGH | CVE-2026-25639 | axios: Axios affected by Denial of Service via __proto__ Key in mergeConfig | 1.13.5, 0.30.3 |
| HIGH | CVE-2026-42033 | axios: Axios: HTTP Transport Hijacking via Prototype Pollution | 1.15.1, 0.31.1 |
| HIGH | CVE-2026-25639 | axios: Axios affected by Denial of Service via __proto__ Key in mergeConfig | 1.13.5, 0.30.3 |
| HIGH | CVE-2026-42033 | axios: Axios: HTTP Transport Hijacking via Prototype Pollution | 1.15.1, 0.31.1 |
| HIGH | CVE-2026-42035 | axios: Axios: Arbitrary HTTP header injection via prototype pollution | 1.15.1, 0.31.1 |
| HIGH | CVE-2026-42043 | axios: Axios: NO_PROXY bypass via crafted URL | 1.15.1, 0.31.1 |
| HIGH | CVE-2026-44488 | axios: Axios: Denial of Service due to unenforced request and response size limits | 1.16.0 |
| HIGH | CVE-2026-44494 | axios: Axios: Man-in-the-Middle (MITM) attack via Prototype Pollution | 1.16.0 |
| HIGH | CVE-2026-44488 | axios: Axios: Denial of Service due to unenforced request and response size limits | 1.16.0 |
| HIGH | CVE-2026-44495 | axios: Axios: Information disclosure due to prototype pollution vulnerability | 1.15.2, 0.31.1 |
| HIGH | CVE-2026-44496 | axios: Axios: Client-side Denial of Service via unescaped regex metacharacters in XSRF cookie name | 1.16.0, 0.32.0 |
| HIGH | CVE-2026-44487 | axios: Axios: Information disclosure of proxy credentials via redirect flows | 1.16.0, 0.32.0 |
| HIGH | CVE-2026-44486 | axios: Axios: Information disclosure of proxy credentials via HTTP redirects | 1.16.0, 0.32.0 |
| HIGH | CVE-2026-42264 | axios: Axios: Prototype pollution allows information disclosure and request manipulation | 1.15.2 |
| HIGH | CVE-2026-42043 | axios: Axios: NO_PROXY bypass via crafted URL | 1.15.1, 0.31.1 |
| HIGH | CVE-2026-42035 | axios: Axios: Arbitrary HTTP header injection via prototype pollution | 1.15.1, 0.31.1 |
| HIGH | CVE-2026-42264 | axios: Axios: Prototype pollution allows information disclosure and request manipulation | 1.15.2 |

### 📦 `lodash` (4 CVEs) — severidade máxima: HIGH

**Ação recomendada:** atualizar de `4.17.21` para `4.18.0` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| HIGH | CVE-2026-4800 | lodash: lodash: Arbitrary code execution via untrusted input in template imports | 4.18.0 |
| HIGH | CVE-2026-4800 | lodash: lodash: Arbitrary code execution via untrusted input in template imports | 4.18.0 |
| MEDIUM | CVE-2025-13465 | lodash: prototype pollution in _.unset and _.omit functions | 4.17.23 |
| MEDIUM | CVE-2026-2950 | lodash: Lodash: Prototype pollution allows deletion of built-in prototype properties via array path bypass | 4.18.0 |

### 📦 `drizzle-orm` (2 CVEs) — severidade máxima: HIGH

**Ação recomendada:** atualizar de `0.44.6` para `0.45.2, 1.0.0-beta.20` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| HIGH | CVE-2026-39356 | Drizzle ORM has SQL injection via improperly escaped SQL identifiers | 0.45.2, 1.0.0-beta.20 |
| HIGH | CVE-2026-39356 | Drizzle ORM has SQL injection via improperly escaped SQL identifiers | 0.45.2, 1.0.0-beta.20 |

### 📦 `form-data` (2 CVEs) — severidade máxima: HIGH

**Ação recomendada:** atualizar de `4.0.4` para `2.5.6, 3.0.5, 4.0.6` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| HIGH | CVE-2026-12143 | form-data: form-data: Form field override via CRLF injection | 2.5.6, 3.0.5, 4.0.6 |
| HIGH | CVE-2026-12143 | form-data: form-data: Form field override via CRLF injection | 2.5.6, 3.0.5, 4.0.6 |

### 📦 `@trpc/server` (2 CVEs) — severidade máxima: HIGH

**Ação recomendada:** atualizar de `11.6.0` para `10.45.3, 11.8.0` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| HIGH | CVE-2025-68130 | tRPC has possible prototype pollution in `experimental_nextAppDirCaller` | 10.45.3, 11.8.0 |
| HIGH | CVE-2025-68130 | tRPC has possible prototype pollution in `experimental_nextAppDirCaller` | 10.45.3, 11.8.0 |

### 📦 `path-to-regexp` (2 CVEs) — severidade máxima: HIGH

**Ação recomendada:** atualizar de `0.1.12` para `0.1.13` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| HIGH | CVE-2026-4867 | path-to-regexp: path-to-regexp: Denial of Service via catastrophic backtracking from malformed URL parameters | 0.1.13 |
| HIGH | CVE-2026-4867 | path-to-regexp: path-to-regexp: Denial of Service via catastrophic backtracking from malformed URL parameters | 0.1.13 |

### 📦 `dompurify` (43 CVEs) — severidade máxima: MEDIUM

**Ação recomendada:** atualizar de `2.5.9` para `3.4.13` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| MEDIUM | — | DOMPurify: IN_PLACE hook removal leaves a detached subtree executable, causing XSS | 3.4.13 |
| MEDIUM | CVE-2026-49458 | dompurify: DOMPurify: Cross-site scripting due to improper sanitization of DOM nodes | 3.4.6 |
| MEDIUM | CVE-2026-49459 | dompurify: DOMPurify: Cross-site scripting bypass allows arbitrary script execution | 3.4.6 |
| MEDIUM | CVE-2026-49978 | dompurify: DOMPurify: Cross-site scripting vulnerability allows code execution | 3.4.7 |
| MEDIUM | CVE-2026-65898 | dompurify: DOMPurify: Cross-site scripting via permanent attribute allowlist pollution | 3.4.11 |
| MEDIUM | CVE-2026-65902 | dompurify: DOMPurify: Sanitization bypass via hook manipulation | 3.4.7 |
| MEDIUM | — | DOMPurify: IN_PLACE hook removal leaves a detached subtree executable, causing XSS | 3.4.13 |
| MEDIUM | CVE-2025-26791 | dompurify: Mutation XSS in DOMPurify Due to Improper Template Literal Handling | 3.2.4 |
| MEDIUM | CVE-2026-41239 | DOMPurify: Vue 2: DOMPurify: Cross-site scripting due to incomplete sanitization of template expressions | 3.4.0 |
| MEDIUM | CVE-2026-41240 | DOMPurify: DOMPurify: Cross-Site Scripting (XSS) via inconsistent tag sanitization | 3.4.0 |
| MEDIUM | CVE-2026-49458 | dompurify: DOMPurify: Cross-site scripting due to improper sanitization of DOM nodes | 3.4.6 |
| MEDIUM | CVE-2026-49459 | dompurify: DOMPurify: Cross-site scripting bypass allows arbitrary script execution | 3.4.6 |
| MEDIUM | CVE-2026-49978 | dompurify: DOMPurify: Cross-site scripting vulnerability allows code execution | 3.4.7 |
| MEDIUM | CVE-2026-65898 | dompurify: DOMPurify: Cross-site scripting via permanent attribute allowlist pollution | 3.4.11 |
| MEDIUM | CVE-2026-65902 | dompurify: DOMPurify: Sanitization bypass via hook manipulation | 3.4.7 |
| MEDIUM | CVE-2026-65903 | dompurify: DOMPurify: Security bypass allows injection of malicious content | 3.4.0 |
| MEDIUM | CVE-2026-65912 | dompurify: DOMPurify: URI validation bypass leads to cross-site scripting | 3.3.2 |
| MEDIUM | CVE-2026-65913 | dompurify: DOMPurify: Cross-Site Scripting (XSS) via prototype pollution in USE_PROFILES mode | 3.3.2 |
| MEDIUM | CVE-2026-65914 | dompurify: DOMPurify: Cross-Site Scripting vulnerability allows arbitrary code execution | 3.3.2 |
| MEDIUM | CVE-2026-49458 | dompurify: DOMPurify: Cross-site scripting due to improper sanitization of DOM nodes | 3.4.6 |
| MEDIUM | CVE-2026-49459 | dompurify: DOMPurify: Cross-site scripting bypass allows arbitrary script execution | 3.4.6 |
| MEDIUM | CVE-2026-49978 | dompurify: DOMPurify: Cross-site scripting vulnerability allows code execution | 3.4.7 |
| MEDIUM | CVE-2026-65898 | dompurify: DOMPurify: Cross-site scripting via permanent attribute allowlist pollution | 3.4.11 |
| MEDIUM | CVE-2026-65902 | dompurify: DOMPurify: Sanitization bypass via hook manipulation | 3.4.7 |
| MEDIUM | — | DOMPurify: IN_PLACE hook removal leaves a detached subtree executable, causing XSS | 3.4.13 |
| MEDIUM | CVE-2026-65902 | DOMPurify before 3.4.7 (affected versions <= 3.4.5) passes direct refe ... | 3.4.7 |
| MEDIUM | CVE-2026-65898 | DOMPurify before 3.4.11 fails to clone the ALLOWED_ATTR allowlist when ... | 3.4.11 |
| MEDIUM | CVE-2026-49978 | dompurify: DOMPurify: Cross-site scripting vulnerability allows code execution | 3.4.7 |
| MEDIUM | CVE-2026-65914 | DOMPurify before 3.3.2 contains a mutation-XSS vulnerability when sani ... | 3.3.2 |
| MEDIUM | CVE-2026-65913 | DOMPurify before 3.3.2 contains a prototype pollution vulnerability in ... | 3.3.2 |
| MEDIUM | CVE-2026-65912 | DOMPurify before 3.3.2 contains a URI validation bypass vulnerability  ... | 3.3.2 |
| MEDIUM | CVE-2026-65903 | dompurify: DOMPurify: Security bypass allows injection of malicious content | 3.4.0 |
| LOW | — | DOMPurify: `CUSTOM_ELEMENT_HANDLING` bypasses `afterSanitizeElements` for allowed custom elements. | 3.4.12 |
| LOW | — | DOMPurify: `CUSTOM_ELEMENT_HANDLING` bypasses `afterSanitizeElements` for allowed custom elements. | 3.4.12 |
| LOW | CVE-2026-65899 | dompurify: DOMPurify: Client-side arbitrary code execution due to improper Trusted Types policy reset | 3.4.9 |
| LOW | CVE-2026-65901 | dompurify: DOMPurify: Cross-site scripting vulnerability via attacker-controlled nodeName | — |
| LOW | — | DOMPurify: `CUSTOM_ELEMENT_HANDLING` bypasses `afterSanitizeElements` for allowed custom elements. | 3.4.12 |
| LOW | CVE-2026-65901 | dompurify: DOMPurify: Cross-site scripting vulnerability via attacker-controlled nodeName | — |
| LOW | CVE-2026-65900 | dompurify: DOMPurify: Template expression injection allows information disclosure | 3.4.8 |
| LOW | CVE-2026-65899 | dompurify: DOMPurify: Client-side arbitrary code execution due to improper Trusted Types policy reset | 3.4.9 |
| LOW | CVE-2026-65899 | dompurify: DOMPurify: Client-side arbitrary code execution due to improper Trusted Types policy reset | 3.4.9 |
| LOW | CVE-2026-65900 | dompurify: DOMPurify: Template expression injection allows information disclosure | 3.4.8 |
| LOW | CVE-2026-65901 | dompurify: DOMPurify: Cross-site scripting vulnerability via attacker-controlled nodeName | — |

### 📦 `baseline-browser-mapping` (1 CVE) — severidade máxima: MEDIUM

**Ação recomendada:** atualizar de `2.10.24` para `2.11.0` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| MEDIUM | CVE-2026-45819 | baseline-browser-mapping: baseline-browser-mapping: Denial of Service via improper input handling | 2.11.0 |

### 📦 `esbuild` (2 CVEs) — severidade máxima: MEDIUM

**Ação recomendada:** atualizar de `0.21.5` para `0.28.1` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| MEDIUM | — | esbuild enables any website to send any requests to the development server and read the response | 0.25.0 |
| LOW | — | esbuild allows arbitrary file read when running the development server on Windows | 0.28.1 |

### 📦 `fflate` (2 CVEs) — severidade máxima: MEDIUM

**Ação recomendada:** atualizar de `0.8.2` para `0.4.9, 0.5.4, 0.6.11, 0.7.5, 0.8.3` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| MEDIUM | CVE-2026-45820 | fflate: fflate: Denial of Service via crafted ZIP archives | 0.4.9, 0.5.4, 0.6.11, 0.7.5, 0.8.3 |
| MEDIUM | CVE-2026-45820 | fflate: fflate: Denial of Service via crafted ZIP archives | 0.4.9, 0.5.4, 0.6.11, 0.7.5, 0.8.3 |

### 📦 `qs` (9 CVEs) — severidade máxima: MEDIUM

**Ação recomendada:** atualizar de `6.15.1` para `6.16.0` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| MEDIUM | CVE-2026-82417 | qs: qs: Denial of Service via improper validation in stringify function | 6.16.0 |
| MEDIUM | CVE-2026-82562 | qs: qs: Denial of Service via array limit bypass in query string parsing | 6.16.0 |
| MEDIUM | CVE-2026-8723 | qs: qs: Denial of Service due to improper handling of null/undefined array elements | 6.15.2 |
| MEDIUM | CVE-2026-82417 | qs: qs: Denial of Service via improper validation in stringify function | 6.16.0 |
| MEDIUM | CVE-2026-82562 | qs: qs: Denial of Service via array limit bypass in query string parsing | 6.16.0 |
| MEDIUM | CVE-2026-8723 | qs: qs: Denial of Service due to improper handling of null/undefined array elements | 6.15.2 |
| MEDIUM | CVE-2025-15284 | qs: qs: Denial of Service via improper input validation in array parsing | 6.14.1 |
| MEDIUM | CVE-2026-8723 | ### Summary    `qs.stringify` throws `TypeError` when called with `arr ... | 6.15.2 |
| MEDIUM | CVE-2025-15284 | qs: qs: Denial of Service via improper input validation in array parsing | 6.14.1 |

### 📦 `uuid` (2 CVEs) — severidade máxima: MEDIUM

**Ação recomendada:** atualizar de `7.0.3` para `11.1.1, 12.0.1, 13.0.1` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| MEDIUM | CVE-2026-41907 | uuid: uuid: Out-of-bounds write vulnerability impacts data integrity and confidentiality | 11.1.1, 12.0.1, 13.0.1 |
| MEDIUM | CVE-2026-41907 | uuid: uuid: Out-of-bounds write vulnerability impacts data integrity and confidentiality | 11.1.1, 12.0.1, 13.0.1 |

### 📦 `micromatch` (1 CVE) — severidade máxima: MEDIUM

**Ação recomendada:** atualizar de `2.3.11` para `4.0.8` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| MEDIUM | CVE-2024-4067 | micromatch: vulnerable to Regular Expression Denial of Service | 4.0.8 |

### 📦 `mermaid` (4 CVEs) — severidade máxima: MEDIUM

**Ação recomendada:** atualizar de `11.12.0` para `11.15.0, 10.9.6` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| MEDIUM | CVE-2026-41149 | mermaid: Mermaid: HTML injection via classDef directive in state diagrams | 11.15.0, 10.9.6 |
| MEDIUM | CVE-2026-41148 | mermaid: Mermaid: CSS injection vulnerability allows page defacement and information disclosure | 11.15.0, 10.9.6 |
| MEDIUM | CVE-2026-41159 | mermaid: Mermaid: Information disclosure and page defacement via CSS injection | 11.15.0, 10.9.6 |
| MEDIUM | CVE-2026-41150 | mermaid: Mermaid: Denial of Service via specially crafted gantt charts | 11.15.0, 10.9.6 |

### 📦 `follow-redirects` (1 CVE) — severidade máxima: MEDIUM

**Ação recomendada:** atualizar de `1.15.11` para `1.16.0` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| MEDIUM | — | follow-redirects leaks Custom Authentication Headers to Cross-Domain Redirect Targets | 1.16.0 |

### 📦 `mdast-util-to-hast` (1 CVE) — severidade máxima: MEDIUM

**Ação recomendada:** atualizar de `13.2.0` para `13.2.1` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| MEDIUM | CVE-2025-66400 | mdast-util-to-hast: mdast-util-to-hast: Markdown code elements can appear as regular page content | 13.2.1 |

### 📦 `body-parser` (2 CVEs) — severidade máxima: LOW

**Ação recomendada:** atualizar de `2.2.2` para `1.20.6, 2.3.0` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| LOW | CVE-2026-12590 | body-parser: body-parser: Denial of Service via invalid limit option | 1.20.6, 2.3.0 |
| LOW | CVE-2026-12590 | body-parser: body-parser: Denial of Service via invalid limit option | 1.20.6, 2.3.0 |

## Segredos expostos

### 🔑 Ministral.MD:178 — Secret detected: Detected a Generic API Key, potentially exposing access to various services and sensitive operations. (HIGH)

Regra: `generic-api-key`

**Remediação:** Remova o valor do código-fonte e mova para uma variável de ambiente / secret manager. Se for uma credencial real (não um placeholder de exemplo), revogue-a imediatamente — ela já está exposta no histórico do Git mesmo após removida do arquivo atual.

### 🔑 firebase-applet-config.json:4 — Secret detected: Uncovered a GCP API key, which could lead to unauthorized access to Google Cloud services and data breaches. (HIGH)

Regra: `gcp-api-key`

**Remediação:** Remova o valor do código-fonte e mova para uma variável de ambiente / secret manager. Se for uma credencial real (não um placeholder de exemplo), revogue-a imediatamente — ela já está exposta no histórico do Git mesmo após removida do arquivo atual.

## Outros findings

| Severidade | Scanner | Categoria | Título | Local |
|---|---|---|---|---|
| HIGH | SEMGREP | SAST | Semgrep Finding: rules.generic.secrets.security.detected-jwt-token.detected-jwt-token | /scan/.env.example:2 |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.dos.regex_dos.regex_dos | /scan/utils/musicUtils.ts:12 |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.timing_attack_node.node_timing_attack | /scan/components/UpdatePasswordScreen.tsx:18 |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.dos.regex_dos.regex_dos | /scan/utils/musicUtils.ts:11 |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | /scan/components/RepertoireScreen.tsx:261 |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.generic.hardcoded_secrets.node_username | /scan/services/scheduleServiceV2.ts:77 |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.generic.error_disclosure.generic_error_disclosure | /scan/components/PaymentSuccessScreen.tsx:20 |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.java.android.security.exported_activity.exported_activity | /scan/android/app/src/main/AndroidManifest.xml:12 |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.generic.error_disclosure.generic_error_disclosure | /scan/services/offlineService.ts:79 |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.generic.hardcoded_secrets.node_username | /scan/services/googleCalendar.ts:9 |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.generic.hardcoded_secrets.node_username | /scan/services/scheduleServiceV2.ts:57 |
| LOW | SEMGREP | SAST | Semgrep Finding: rules.javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring | /scan/services/aiOrchestrator.ts:366 |
| LOW | SEMGREP | SAST | Semgrep Finding: rules.javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring | /scan/services/supabase/client.ts:74 |
| LOW | SEMGREP | SAST | Semgrep Finding: rules.javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring | /scan/services/supabase/client.ts:67 |
