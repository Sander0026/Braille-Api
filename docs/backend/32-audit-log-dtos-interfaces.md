# 32 — Audit Log: DTOs e Interfaces

---

# 1. Visão Geral

## Objetivo

Documentar os DTOs e interfaces usados pelo módulo `AuditLog` da Braille API.

Arquivos documentados:

```txt
src/audit-log/dto/query-audit.dto.ts
src/audit-log/interfaces/audit-options.interface.ts
```

## Responsabilidade

Essas estruturas definem os contratos de entrada e registro do módulo de auditoria.

Responsabilidades principais:

- validar filtros de consulta de logs;
- limitar paginação para evitar sobrecarga;
- validar ações com enum `AuditAcao`;
- validar intervalo de datas em formato ISO;
- padronizar dados exigidos para registrar auditoria;
- permitir snapshots `oldValue` e `newValue` sem usar `any`;
- manter compatibilidade com módulos ainda não totalmente migrados para enum forte de role.

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- DTO Pattern;
- Interface Contract Pattern;
- Query Filter Pattern;
- Pagination Guard Pattern;
- Enum Validation Pattern;
- Type-safe Audit Contract;
- Defensive API Design.

## Justificativa Técnica

A auditoria é uma área sensível. As consultas podem acessar grande volume de dados e snapshots de operações administrativas.

Por isso, `QueryAuditDto` limita paginação e valida filtros antes de chegar ao `AuditLogService`.

Já `AuditOptions` define um contrato claro para qualquer módulo que precise registrar eventos de auditoria, sem depender de objetos soltos ou `any`.

---

# 3. Fluxo Interno do Código

## `QueryAuditDto`

Arquivo:

```txt
src/audit-log/dto/query-audit.dto.ts
```

Responsável por validar filtros da rota:

```txt
GET /audit-log
```

Campos:

| Campo | Validações | Padrão | Objetivo |
|---|---|---|---|
| `page` | `Type(Number)`, `IsInt`, `Min(1)`, `Max(10000)` | `1` | Página atual |
| `limit` | `Type(Number)`, `IsInt`, `Min(1)`, `Max(100)` | `20` | Itens por página |
| `entidade` | `IsString`, `IsOptional` | — | Filtrar por entidade |
| `registroId` | `IsString`, `IsOptional` | — | Filtrar por registro afetado |
| `autorId` | `IsString`, `IsOptional` | — | Filtrar por autor da ação |
| `acao` | `IsEnum(AuditAcao)`, `IsOptional` | — | Filtrar por ação |
| `de` | `IsDateString`, `IsOptional` | — | Data inicial ISO |
| `ate` | `IsDateString`, `IsOptional` | — | Data final ISO |

## Paginação

A paginação possui limites defensivos:

```txt
page <= 10000
limit <= 100
```

O limite de `100` por página protege a API contra consultas grandes demais.

O limite de `page` evita valores extremos que poderiam gerar offsets impraticáveis.

## Filtros por Data

Os campos `de` e `ate` exigem data ISO.

No service, eles são convertidos para `Date` e aplicados no filtro `criadoEm`.

## `AuditOptions`

Arquivo:

```txt
src/audit-log/interfaces/audit-options.interface.ts
```

Contrato usado por qualquer módulo que chama:

```txt
AuditLogService.registrar(opts)
```

Campos:

| Campo | Tipo | Obrigatório | Objetivo |
|---|---|---:|---|
| `entidade` | string | Sim | Entidade auditada |
| `registroId` | string | Não | ID do registro afetado |
| `acao` | `AuditAcao` | Sim | Ação executada |
| `autorId` | string | Não | ID do autor |
| `autorNome` | string | Não | Nome do autor |
| `autorRole` | string | Não | Perfil do autor |
| `ip` | string | Não | IP da requisição |
| `userAgent` | string | Não | User agent da requisição |
| `oldValue` | unknown | Não | Snapshot anterior |
| `newValue` | unknown | Não | Snapshot novo |

## Uso de `unknown`

`oldValue` e `newValue` usam `unknown` em vez de `any`.

Isso é positivo porque força o `AuditLogService` a serializar os valores com segurança antes de persistir no banco.

---

# 4. Dicionário Técnico

## Campos de Query

| Campo | Tipo | Impacto |
|---|---|---|
| `page` | number | Define offset de paginação |
| `limit` | number | Controla volume retornado |
| `entidade` | string | Restringe por domínio auditado |
| `registroId` | string | Busca histórico de item específico |
| `autorId` | string | Busca ações de um usuário |
| `acao` | `AuditAcao` | Restringe por tipo de ação |
| `de` | string ISO | Início do período |
| `ate` | string ISO | Fim do período |

## Campos de Registro

| Campo | Tipo | Impacto |
|---|---|---|
| `entidade` | string | Classifica o log |
| `registroId` | string opcional | Vincula log ao registro |
| `acao` | `AuditAcao` | Define a natureza da ação |
| `autorId` | string opcional | Identifica usuário executor |
| `autorNome` | string opcional | Facilita leitura humana |
| `autorRole` | string opcional | Informa perfil do executor |
| `ip` | string opcional | Rastreabilidade de origem |
| `userAgent` | string opcional | Rastreabilidade do cliente |
| `oldValue` | unknown opcional | Estado anterior |
| `newValue` | unknown opcional | Estado posterior |

## Classes e Interfaces

| Estrutura | Responsabilidade |
|---|---|
| `QueryAuditDto` | Validar filtros de consulta |
| `AuditOptions` | Padronizar registro de auditoria |

## Dependências Externas

| Dependência | Uso |
|---|---|
| `class-validator` | Validar campos |
| `class-transformer` | Converter query params numéricos |
| `@nestjs/swagger` | Documentar filtros |
| `@prisma/client` | Enum `AuditAcao` |

---

# 5. Serviços e Integrações

## APIs

`QueryAuditDto` é usado em:

```txt
GET /audit-log
```

`AuditOptions` é usado por:

```txt
AuditLogService.registrar()
```

## Banco de Dados

Os DTOs/interfaces não acessam banco diretamente.

O `AuditLogService` converte esses contratos em operações Prisma sobre o model `AuditLog`.

## Módulos Consumidores

`AuditOptions` pode ser construído por:

- `AuditInterceptor`;
- `UsersService`;
- `BeneficiariesService`;
- `TurmasService`;
- `FrequenciasService`;
- `ComunicadosService`;
- `UploadService`;
- demais services com auditoria manual.

---

# 6. Segurança e Qualidade

## Segurança

Pontos fortes:

- `limit` máximo de 100 reduz risco de carga excessiva;
- `page` tem máximo definido;
- `acao` aceita apenas valores do enum `AuditAcao`;
- datas precisam ser ISO válidas;
- snapshots usam `unknown`, não `any`;
- contrato não obriga persistir dados sensíveis, ficando sob controle do chamador e do service.

## Qualidade

Pontos positivos:

- DTO pequeno e claro;
- validações declarativas;
- integração com Swagger;
- filtros opcionais e combináveis;
- interface de registro reutilizável;
- compatibilidade com módulos em migração por `autorRole?: string`.

## Performance

- limite de página controla volume de resposta;
- filtros opcionais reduzem volume consultado;
- validação ocorre antes da query;
- tipos numéricos são convertidos antes do service.

---

# 7. Regras de Negócio Representadas

- auditoria deve ser consultada com paginação;
- cada página pode retornar no máximo 100 logs;
- filtros podem ser combinados;
- ações só podem ser valores válidos de `AuditAcao`;
- datas de período devem ser ISO;
- um registro de auditoria deve conter pelo menos entidade e ação;
- snapshots são opcionais.

---

# 8. Pontos de Atenção

## Riscos

- `entidade`, `registroId` e `autorId` são strings livres; não há validação de UUID nesses campos.
- `autorRole` é string por compatibilidade, mas poderia ser mais forte com enum.
- `page` até 10000 ainda pode gerar offset alto em bases grandes.
- `oldValue` e `newValue` dependem da sanitização/serialização do service.

## Débitos Técnicos

- Avaliar validação de UUID para `registroId` e `autorId` quando aplicável.
- Avaliar filtro por `autorRole`.
- Trocar `autorRole?: string` por enum quando todos os módulos estiverem padronizados.
- Avaliar paginação cursor-based para alto volume.

## Melhorias Futuras

- Criar DTO específico para histórico por registro;
- adicionar filtro por `autorRole`;
- adicionar filtro por IP;
- adicionar filtro por entidade com enum interno;
- criar DTO de exportação de logs;
- evoluir paginação para cursor em bases grandes.

---

# 9. Relação com Outros Módulos

| Módulo | Relação |
|---|---|
| `AuditLogController` | Usa `QueryAuditDto` |
| `AuditLogService` | Usa `QueryAuditDto` e `AuditOptions` |
| `AuditInterceptor` | Monta `AuditOptions` automaticamente |
| Services de domínio | Montam `AuditOptions` manualmente |
| Prisma | Fornece enum `AuditAcao` |
| Swagger | Documenta os filtros |

---

# 10. Resumo Técnico Final

`QueryAuditDto` e `AuditOptions` formam a camada contratual do módulo de auditoria.

Eles validam consultas administrativas, limitam paginação, padronizam filtros e definem como outros módulos registram eventos de auditoria.

Criticidade: alta.

Complexidade: média.

A implementação está profissional. As principais evoluções recomendadas são fortalecer `autorRole`, avaliar UUIDs em filtros, adicionar novos filtros administrativos e considerar paginação cursor-based para grande volume.
