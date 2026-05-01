# 18 — Common: Visão Geral (`src/common/`)

---

# 1. Visão Geral

## Objetivo

Documentar a visão geral da pasta `src/common/`, responsável por recursos transversais reutilizados por múltiplos módulos da Braille API.

A pasta `common` concentra elementos que não pertencem exclusivamente a um domínio de negócio, mas sustentam padronização, segurança, auditoria, validação, tratamento de erros e tipagem global.

## Responsabilidade

Principais responsabilidades:

- padronizar respostas HTTP com `ApiResponse`;
- tratar erros Prisma de forma segura;
- registrar auditoria automática em mutações;
- permitir desativação de auditoria automática com `@SkipAudit()`;
- sanitizar HTML em rotas de conteúdo;
- centralizar dados de auditoria do usuário autenticado;
- tipar requisições autenticadas;
- reduzir duplicação entre controllers e services.

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- Cross-Cutting Concerns;
- DTO Pattern;
- Exception Filter Pattern;
- Interceptor Pattern;
- Pipe Pattern;
- Decorator Metadata Pattern;
- Helper Centralization;
- Type-safe Request Enrichment;
- Security by Default.

## Justificativa Técnica

A pasta `common` evita duplicação e mantém regras técnicas compartilhadas em um único lugar.

Isso melhora:

- manutenção;
- consistência de respostas;
- segurança contra vazamento de detalhes internos;
- reaproveitamento de helpers;
- auditoria padronizada;
- tipagem em controllers protegidos.

---

# 3. Componentes Principais

## `ApiResponse`

Arquivo:

```txt
src/common/dto/api-response.dto.ts
```

Responsabilidade:

- encapsular respostas com `success`, `message` e `data`;
- fornecer factories `ok()` e `error()`;
- facilitar consumo padronizado pelo frontend;
- documentar estrutura no Swagger.

## Filtros Prisma

Arquivo:

```txt
src/common/filters/prisma-exception.filter.ts
```

Filtros:

- `PrismaExceptionFilter`;
- `PrismaValidationFilter`.

Responsabilidade:

- mapear erros conhecidos do Prisma;
- retornar mensagens públicas seguras;
- registrar detalhes técnicos apenas no servidor;
- evitar exposição de schema, tabelas, colunas e queries.

Códigos tratados:

| Código | Status |
|---|---|
| `P2002` | Conflict |
| `P2003` | Bad Request |
| `P2025` | Not Found |

## `AuditInterceptor`

Arquivo:

```txt
src/common/interceptors/audit.interceptor.ts
```

Responsabilidade:

- auditar mutações HTTP (`POST`, `PATCH`, `PUT`, `DELETE`);
- mapear método/rota para `AuditAcao`;
- identificar entidade pelo path;
- coletar autor, IP e user agent;
- sanitizar payload antes de persistir;
- registrar auditoria sem bloquear a resposta.

O interceptor usa estratégia fire-and-forget via `tap()`.

## `SanitizeHtmlPipe`

Arquivo:

```txt
src/common/pipes/sanitize-html.pipe.ts
```

Responsabilidade:

- sanitizar HTML em payloads `body`;
- usar DOMPurify com JSDOM no backend;
- permitir apenas tags e atributos controlados;
- sanitizar objetos e arrays recursivamente;
- tratar strings JSON válidas.

Usado em rotas como comunicados e CMS.

## `SkipAudit`

Arquivo:

```txt
src/common/decorators/skip-audit.decorator.ts
```

Responsabilidade:

- marcar controller ou rota para ignorar auditoria automática;
- permitir auditoria manual no service quando a operação exige contexto mais específico.

## Helpers de Auditoria

Arquivo:

```txt
src/common/helpers/audit.helper.ts
```

Funções principais:

| Função | Objetivo |
|---|---|
| `getAuditUser()` | Extrair usuário, role, IP e user agent da requisição |
| `toAuditMetadata()` | Converter `AuditUser` para metadados persistíveis |
| `resolverIp()` | Resolver IP real com suporte a proxy |

## Interfaces

Arquivos principais:

```txt
src/common/interfaces/authenticated-request.interface.ts
src/common/interfaces/audit-user.interface.ts
```

Interfaces:

| Interface | Objetivo |
|---|---|
| `AuthenticatedUser` | Representar payload JWT em `req.user` |
| `AuthenticatedRequest` | Tipar request Express autenticado |
| `AuditUser` | Centralizar dados do autor para auditoria |

---

# 4. Dicionário Técnico

## Estruturas

| Nome | Tipo | Objetivo |
|---|---|---|
| `ApiResponse<T>` | DTO genérico | Padronizar resposta HTTP |
| `PrismaExceptionFilter` | Filter | Tratar erros conhecidos do Prisma |
| `PrismaValidationFilter` | Filter | Tratar erro de validação Prisma |
| `AuditInterceptor` | Interceptor | Registrar auditoria automática |
| `SanitizeHtmlPipe` | Pipe | Sanitizar HTML em body |
| `SkipAudit` | Decorator | Ignorar auditoria automática |
| `AuditUser` | Interface | Dados de auditoria do autor |
| `AuthenticatedRequest` | Interface | Request autenticado |

## Funções e Métodos

| Função/Método | Objetivo |
|---|---|
| `ApiResponse.ok()` | Criar resposta de sucesso |
| `ApiResponse.error()` | Criar resposta de erro lógica |
| `resolveHttpStatus()` | Converter código Prisma em status HTTP |
| `AuditInterceptor.intercept()` | Auditar mutações HTTP |
| `sanitizePayload()` | Remover dados sensíveis do log |
| `sanitizeRecursively()` | Sanitizar payload HTML |
| `getAuditUser()` | Extrair usuário para auditoria |
| `resolverIp()` | Resolver IP real |

---

# 5. Serviços e Integrações

## APIs

`common` não expõe endpoints diretamente.

Ele é consumido por controllers, services e providers globais.

## Banco de Dados

`common` não acessa banco diretamente, exceto de forma indireta pelo `AuditInterceptor`, que chama `AuditLogService` para registrar auditoria.

## Serviços Externos

- DOMPurify;
- JSDOM;
- Prisma Client errors;
- NestJS Logger;
- cache/reflection/interceptors do NestJS.

---

# 6. Segurança e Qualidade

## Segurança

Pontos fortes:

- erros Prisma não vazam detalhes internos;
- payload de auditoria remove campos sensíveis;
- strings longas e arrays grandes são truncados em auditoria;
- HTML é sanitizado em rotas de conteúdo;
- IP é resolvido com suporte a proxies;
- `AuditUser` usa enum `Role` tipado.

## Qualidade

- helpers centralizam lógica repetida;
- interfaces reduzem uso de `any`;
- decorator `SkipAudit` torna intenção explícita;
- factories de `ApiResponse` reduzem boilerplate;
- filtros globais padronizam erros.

## Performance

- DOMPurify/JSDOM é singleton no pipe;
- auditoria é fire-and-forget e não bloqueia resposta;
- payloads de auditoria são truncados para evitar blobs grandes.

---

# 7. Regras de Negócio Transversais

- mutações devem ser auditáveis;
- dados sensíveis não devem ser persistidos em logs;
- erros internos do banco não devem ir para o cliente;
- rotas com auditoria manual devem usar `@SkipAudit()`;
- conteúdo HTML editável deve passar por sanitização;
- controllers devem usar `getAuditUser(req)` para auditoria manual.

---

# 8. Pontos de Atenção

- `AuditInterceptor` usa heurística por path; novos módulos precisam atualizar `ENTIDADE_MAP`.
- `PATHS_EXCLUIDOS` deve ser revisado quando novas rotas técnicas forem criadas.
- `SanitizeHtmlPipe` permite atributo `style`; isso deve ser acompanhado conforme política de frontend.
- `getAuditUser()` usa fallback de role `SECRETARIA`; é seguro por menor privilégio, mas deve ser monitorado.
- O `ApiResponse` não é usado uniformemente em todas as rotas.

---

# 9. Melhorias Futuras

- Padronizar uso de `ApiResponse` em todos os módulos.
- Criar testes unitários para filtros Prisma.
- Criar testes para `SanitizeHtmlPipe` com payloads maliciosos.
- Criar enum central para entidades auditáveis.
- Substituir heurística de path por metadata explícita de auditoria.
- Revisar política de atributos HTML permitidos.

---

# 10. Resumo Técnico Final

A pasta `src/common` representa a camada transversal da Braille API. Ela concentra padronização, segurança, auditoria, sanitização, tratamento de erros e tipagem compartilhada.

Criticidade: alta.

Complexidade: média/alta.

A estrutura está profissional e reduz duplicação. Os principais cuidados futuros são padronizar `ApiResponse`, evoluir auditoria para metadata explícita e reforçar testes de segurança nos filtros e pipes.
