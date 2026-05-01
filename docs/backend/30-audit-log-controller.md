# 30 — AuditLogController (`src/audit-log/audit-log.controller.ts`)

---

# 1. Visão Geral

## Objetivo

Documentar o `AuditLogController`, responsável por expor as rotas administrativas de consulta dos logs de auditoria da Braille API.

## Responsabilidade

O controller atua como camada HTTP do módulo de auditoria.

Responsabilidades principais:

- expor endpoints de consulta de auditoria;
- restringir acesso ao perfil `ADMIN`;
- receber filtros via `QueryAuditDto`;
- delegar consultas ao `AuditLogService`;
- documentar endpoints no Swagger;
- retornar respostas padronizadas com `ApiResponse`.

## Regra de Acesso

Todas as rotas do controller são restritas a:

```txt
ADMIN
```

A proteção é aplicada na classe com:

```txt
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
```

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- Controller-Service Pattern;
- Thin Controller Pattern;
- RBAC;
- DTO Pattern;
- Swagger Documentation Pattern;
- Query Filter Pattern.

## Justificativa Técnica

Logs de auditoria expõem informações sensíveis sobre alterações, autores, IPs, user agents e snapshots de dados. Por isso, a consulta é restrita ao `ADMIN`.

O controller é fino: não monta queries, não acessa banco e não contém lógica de auditoria. Ele apenas recebe parâmetros e delega para o service.

---

# 3. Fluxo Interno do Código

## Decorators de Classe

O controller usa:

```txt
@ApiTags('Auditoria (Logs do Sistema)')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('audit-log')
```

Impacto:

- agrupa os endpoints no Swagger;
- exige token Bearer;
- valida autenticação JWT;
- valida autorização de ADMIN;
- define a rota base `/audit-log`.

## Constructor

```ts
constructor(private readonly auditLogService: AuditLogService) {}
```

Injeta `AuditLogService` para delegar as consultas.

## `GET /audit-log`

Método:

```ts
findAll(@Query() query: QueryAuditDto)
```

Responsabilidade:

- receber filtros e paginação;
- chamar `auditLogService.findAll(query)`;
- retornar lista paginada de logs.

Filtros aceitos pelo DTO:

- `page`;
- `limit`;
- `entidade`;
- `registroId`;
- `autorId`;
- `acao`;
- `de`;
- `ate`.

## `GET /audit-log/stats`

Método:

```ts
stats()
```

Responsabilidade:

- chamar `auditLogService.stats()`;
- retornar estatísticas rápidas de auditoria.

Dados esperados:

- total de logs;
- logs de hoje;
- top ações.

## `GET /audit-log/:entidade/:registroId`

Método:

```ts
findByRegistro(@Param('entidade') entidade, @Param('registroId') registroId)
```

Responsabilidade:

- receber entidade e ID do registro pela URL;
- chamar `auditLogService.findByRegistro(entidade, registroId)`;
- retornar histórico do registro.

---

# 4. Dicionário Técnico

## Variáveis e Parâmetros

| Nome | Tipo | Origem | Objetivo |
|---|---|---|---|
| `query` | `QueryAuditDto` | Query string | Filtros de consulta |
| `entidade` | string | URL param | Nome da entidade auditada |
| `registroId` | string | URL param | ID do registro auditado |
| `auditLogService` | `AuditLogService` | DI | Executar consultas |

## Métodos

| Método | Rota | Objetivo |
|---|---|---|
| `findAll()` | `GET /audit-log` | Listar logs com filtros |
| `stats()` | `GET /audit-log/stats` | Retornar estatísticas rápidas |
| `findByRegistro()` | `GET /audit-log/:entidade/:registroId` | Histórico de registro |

## Tipagens

| Tipo | Uso |
|---|---|
| `QueryAuditDto` | Validação de filtros |
| `ApiResponse<unknown>` | Padronização de resposta |

---

# 5. Serviços e Integrações

## APIs

| Método | Endpoint | Proteção | Service chamado |
|---|---|---|---|
| `GET` | `/audit-log` | `ADMIN` | `findAll()` |
| `GET` | `/audit-log/stats` | `ADMIN` | `stats()` |
| `GET` | `/audit-log/:entidade/:registroId` | `ADMIN` | `findByRegistro()` |

## Banco de Dados

O controller não acessa banco diretamente. O acesso é feito pelo `AuditLogService` via `PrismaService`.

## Swagger

O controller usa:

- `@ApiTags`;
- `@ApiBearerAuth`;
- `@ApiOperation`;
- `@SwaggerResponse`.

Isso documenta os endpoints e reforça a necessidade de autenticação Bearer no Swagger.

---

# 6. Segurança e Qualidade

## Segurança

Pontos fortes:

- todas as rotas exigem JWT;
- todas as rotas exigem `ADMIN`;
- não existe rota pública de auditoria;
- controller não expõe lógica interna de query;
- filtros são validados por DTO;
- respostas são padronizadas pelo service.

## Qualidade

Pontos positivos:

- controller fino;
- baixo acoplamento;
- rotas claras;
- Swagger documentado;
- separação entre listagem, estatística e histórico.

## Performance

O controller não executa processamento pesado. A performance depende do service, paginação e índices do banco.

---

# 7. Regras de Negócio

- somente `ADMIN` pode consultar auditoria;
- listagem deve aceitar filtros e paginação;
- histórico por registro deve receber entidade e registroId;
- estatísticas devem ser separadas da listagem para evitar sobrecarregar consulta principal;
- controller não registra auditoria; apenas consulta logs existentes.

---

# 8. Pontos de Atenção

## Riscos

- `@Roles('ADMIN')` usa string literal. Funciona, mas é menos padronizado do que `Role.ADMIN`.
- Parâmetros `entidade` e `registroId` são strings livres; a validação semântica ocorre no service/banco.
- Logs podem conter snapshots sensíveis, então a restrição ao ADMIN deve ser mantida.

## Débitos Técnicos

- Padronizar `@Roles('ADMIN')` para `@Roles(Role.ADMIN)`.
- Criar DTO específico para parâmetros de histórico, se necessário.
- Criar testes e2e garantindo que apenas ADMIN acessa auditoria.

## Melhorias Futuras

- Adicionar filtros por `autorRole`;
- endpoint de exportação CSV;
- paginação cursor-based para alto volume;
- endpoint para ações sensíveis recentes;
- dashboard de auditoria com agregações avançadas.

---

# 9. Relação com Outros Módulos

| Módulo | Relação |
|---|---|
| `AuditLogService` | Executa consultas |
| `AuthGuard` | Valida JWT |
| `RolesGuard` | Restringe ao ADMIN |
| `QueryAuditDto` | Valida filtros |
| `ApiResponse` | Padroniza retorno |
| Frontend Admin | Consome listagem, stats e histórico |

---

# 10. Resumo Técnico Final

O `AuditLogController` é uma camada HTTP enxuta e segura para consulta de auditoria.

Ele expõe listagem, estatísticas e histórico por registro, todos restritos ao perfil `ADMIN`.

Criticidade: alta.

Complexidade: baixa/média.

A implementação está profissional. A principal melhoria recomendada é padronizar `@Roles('ADMIN')` para `@Roles(Role.ADMIN)` e criar testes e2e de acesso por perfil.
