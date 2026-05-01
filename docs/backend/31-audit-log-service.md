# 31 — AuditLogService (`src/audit-log/audit-log.service.ts`)

---

# 1. Visão Geral

## Objetivo

Documentar o `AuditLogService`, serviço responsável por registrar e consultar logs de auditoria da Braille API.

O service é usado tanto pelo `AuditLogController`, para consultas administrativas, quanto por outros módulos, para registrar ações sensíveis de forma manual ou automática via interceptor.

## Responsabilidade

Responsabilidades principais:

- registrar eventos de auditoria;
- persistir entidade, registro, ação, autor e contexto da requisição;
- armazenar snapshots `oldValue` e `newValue` de forma segura;
- não interromper o fluxo principal se a auditoria falhar;
- listar logs com filtros e paginação;
- consultar histórico de um registro específico;
- calcular estatísticas rápidas;
- tratar datas considerando o fuso horário de Brasília.

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- Service Layer;
- Audit Trail Pattern;
- Fire-and-forget Logging;
- Safe Serialization Pattern;
- Type-safe Prisma Query Pattern;
- Pagination Pattern;
- Aggregation Pattern;
- Timezone-aware Date Calculation.

## Justificativa Técnica

A auditoria não pode ser um ponto único de falha para operações de negócio. Por isso, o método `registrar()` captura erros e registra warnings, sem lançar exceção para o fluxo principal.

Ao mesmo tempo, consultas administrativas precisam ser confiáveis, paginadas e filtráveis para análise posterior.

A serialização segura é necessária porque snapshots podem conter objetos complexos, datas, BigInt, buffers, funções, símbolos ou referências circulares.

---

# 3. Fluxo Interno do Código

## Dependência Injetada

| Dependência | Uso |
|---|---|
| `PrismaService` | Persistir e consultar registros `AuditLog` |

## `registrar()`

Responsável por persistir um evento de auditoria.

Entrada:

```txt
AuditOptions
```

Campos principais:

- `entidade`;
- `registroId`;
- `acao`;
- `autorId`;
- `autorNome`;
- `autorRole`;
- `ip`;
- `userAgent`;
- `oldValue`;
- `newValue`.

Fluxo:

```txt
recebe AuditOptions
  ↓
serializarSeguro(oldValue)
  ↓
serializarSeguro(newValue)
  ↓
prisma.auditLog.create()
  ↓
se falhar, logger.warn()
  ↓
não lança erro para o chamador
```

## `findAll()`

Lista logs com filtros e paginação.

Fluxo:

1. resolve `page`, `limit` e `skip`;
2. monta `where` com tipo `Prisma.AuditLogWhereInput`;
3. aplica filtros opcionais;
4. executa `findMany` e `count` em paralelo;
5. retorna `ApiResponse` com `data` e `meta`.

Filtros suportados:

- entidade;
- registroId;
- autorId;
- ação;
- data inicial (`de`);
- data final (`ate`).

## `findByRegistro()`

Busca histórico de uma entidade e registro específico.

Características:

- filtra por `entidade` e `registroId`;
- ordena por `criadoEm desc`;
- limita a 50 entradas;
- retorna `ApiResponse`.

## `stats()`

Calcula estatísticas rápidas.

Dados retornados:

- `totalLogs`;
- `logsHoje`;
- `topAcoes`.

Usa `Promise.all()` para executar contagens e agrupamento em paralelo.

## `serializarSeguro()`

Método estático responsável por converter qualquer valor em JSON seguro para persistência no Prisma.

Regras:

- `undefined` e `null` viram `undefined`;
- `Date` vira ISO string;
- `bigint` vira string;
- número infinito vira string;
- função e símbolo viram marcador textual;
- binário vira marcador com tamanho;
- arrays são normalizados item a item;
- referências circulares viram marcador;
- objetos são normalizados recursivamente.

## `normalizarParaJson()`

Helper privado que executa a normalização recursiva usando `WeakSet` para detectar referência circular.

## `midnightBrasilia()`

Calcula o início do dia atual no fuso `America/Sao_Paulo`.

Motivo:

```txt
Evitar bug de servidor UTC contar logs de hoje com deslocamento incorreto.
```

---

# 4. Dicionário Técnico

## Variáveis

| Nome | Objetivo |
|---|---|
| `logger` | Registrar warnings de falha de auditoria |
| `opts` | Opções de registro de auditoria |
| `page` | Página atual |
| `limit` | Itens por página |
| `skip` | Offset da consulta |
| `where` | Filtro Prisma tipado |
| `logs` | Resultado da consulta paginada |
| `total` | Total de registros filtrados |
| `inicioHoje` | Início do dia no fuso de Brasília |
| `porAcao` | Agrupamento por ação |
| `visitados` | `WeakSet` para detectar ciclos |

## Métodos

| Método | Objetivo |
|---|---|
| `registrar()` | Persistir evento de auditoria |
| `findAll()` | Listar logs com filtros |
| `findByRegistro()` | Histórico de um registro |
| `stats()` | Estatísticas rápidas |
| `serializarSeguro()` | Converter snapshot para JSON seguro |
| `normalizarParaJson()` | Normalização recursiva |
| `midnightBrasilia()` | Início do dia em Brasília |

## Tipagens

| Tipo | Uso |
|---|---|
| `AuditOptions` | Entrada de registro |
| `QueryAuditDto` | Filtros de consulta |
| `ApiResponse<unknown>` | Resposta padronizada |
| `Prisma.AuditLogWhereInput` | Query type-safe |
| `Prisma.InputJsonValue` | Snapshot JSON persistível |

---

# 5. Serviços e Integrações

## Banco de Dados

Model principal:

```txt
AuditLog
```

Operações usadas:

| Operação Prisma | Uso |
|---|---|
| `auditLog.create()` | Registrar evento |
| `auditLog.findMany()` | Listar logs |
| `auditLog.count()` | Contar logs |
| `auditLog.groupBy()` | Agrupar por ação |

## Módulos Consumidores

O service pode ser usado por:

- `AuditInterceptor`;
- `UsersService`;
- `BeneficiariesService`;
- `TurmasService`;
- `FrequenciasService`;
- `ComunicadosService`;
- `UploadService`;
- `CertificadosService`;
- demais services com auditoria manual.

---

# 6. Segurança e Qualidade

## Segurança

Pontos fortes:

- falhas de auditoria não expõem detalhes ao cliente;
- snapshots são convertidos para JSON seguro;
- referências circulares são tratadas;
- dados binários não são persistidos integralmente;
- objetos complexos são normalizados;
- consulta administrativa fica protegida no controller.

## Qualidade

Pontos positivos:

- `where` tipado com Prisma;
- sem uso de `any` no filtro principal;
- paginação consistente;
- limite de histórico por registro;
- helper estático evita recriação de funções;
- cálculo de data corrigido para Brasília.

## Performance

- registro usa apenas uma escrita simples;
- consultas usam paginação;
- `findAll()` e `stats()` usam paralelismo com `Promise.all()`;
- serialização usa `WeakSet` para evitar loops infinitos;
- histórico por registro limita a 50 entradas.

---

# 7. Regras de Negócio

- auditoria deve registrar entidade e ação;
- auditoria não deve interromper operação principal;
- logs são retornados em ordem decrescente de criação;
- histórico por registro retorna até 50 eventos;
- listagem retorna metadados de paginação;
- logs de hoje devem considerar Brasília;
- top ações deve retornar no máximo 10 ações.

---

# 8. Pontos de Atenção

## Riscos

- Auditoria tolerante a falhas depende de monitoramento de warnings.
- Snapshots podem conter dados sensíveis se o módulo chamador enviar dados não sanitizados.
- Offset alto em paginação pode ficar custoso em bases grandes.
- `autorRole` aceita string por compatibilidade, mas isso reduz rigidez do contrato.

## Débitos Técnicos

- Criar testes unitários para `serializarSeguro()`.
- Criar testes para `midnightBrasilia()`.
- Criar alerta para falhas persistentes de auditoria.
- Avaliar retenção/arquivamento de logs antigos.
- Criar índices conforme volume real.

## Melhorias Futuras

- Paginação cursor-based;
- exportação CSV;
- correlation ID;
- logs estruturados;
- filtros por `autorRole`;
- alerta para ações críticas;
- job de arquivamento de logs antigos.

---

# 9. Relação com Outros Módulos

| Módulo | Relação |
|---|---|
| `AuditLogController` | Consulta logs e stats |
| `AuditInterceptor` | Registra auditoria automática |
| `UsersService` | Registra auditoria administrativa |
| `Common/getAuditUser` | Fornece dados de autor |
| `PrismaService` | Persiste logs |
| Frontend Admin | Consome dados de auditoria |

---

# 10. Resumo Técnico Final

O `AuditLogService` é o núcleo da rastreabilidade do backend.

Ele registra eventos de forma tolerante a falhas, consulta logs com filtros, gera estatísticas e serializa snapshots complexos de forma segura.

Criticidade: muito alta.

Complexidade: média/alta.

A implementação está profissional. Os principais pontos de evolução são monitoramento de falhas, testes unitários da serialização e política de retenção de logs.
