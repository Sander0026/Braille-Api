# 29 — Audit Log: Visão Geral do Módulo (`src/audit-log/`)

---

# 1. Visão Geral

## Objetivo

Documentar a visão geral do módulo `AuditLog`, responsável por registrar, consultar e expor trilhas de auditoria da Braille API.

Arquivos principais:

```txt
src/audit-log/audit-log.module.ts
src/audit-log/audit-log.controller.ts
src/audit-log/audit-log.service.ts
src/audit-log/dto/query-audit.dto.ts
src/audit-log/interfaces/audit-options.interface.ts
```

## Responsabilidade

O módulo `AuditLog` é responsável por:

- registrar ações sensíveis executadas no sistema;
- armazenar entidade, registro, ação, autor, IP, user agent e snapshots;
- permitir consulta paginada de logs;
- permitir filtro por entidade, registro, autor, ação e período;
- exibir histórico de um registro específico;
- expor estatísticas rápidas de auditoria;
- servir como infraestrutura para auditoria automática e manual;
- não interromper fluxos principais caso o registro de auditoria falhe.

## Acesso

As rotas de consulta do módulo são restritas a:

```txt
ADMIN
```

O controller usa `AuthGuard`, `RolesGuard` e `@Roles('ADMIN')`.

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- Audit Trail Pattern;
- Service Layer;
- Controller-Service Pattern;
- DTO Pattern;
- RBAC;
- Fire-and-forget Logging;
- Safe Serialization Pattern;
- Query Pagination Pattern;
- Statistics Aggregation Pattern.

## Justificativa Técnica

A auditoria é essencial em sistemas administrativos que manipulam usuários, alunos, documentos, frequências, laudos, certificados e conteúdo institucional.

O módulo foi projetado para ser reutilizável por outros módulos. Por isso, `AuditLogModule` exporta `AuditLogService`, permitindo que services de domínio registrem auditoria manual com contexto específico.

O registro de auditoria é tolerante a falhas: se falhar, gera warning no log, mas não interrompe a operação principal.

---

# 3. Fluxo Interno do Código

## AuditLogModule

Importa:

- `PrismaModule`.

Declara:

- `AuditLogController`;
- `AuditLogService`.

Exporta:

- `AuditLogService`.

Essa exportação permite injeção do service em outros módulos, como `Users`, `Turmas`, `Beneficiaries`, `Frequencias`, `Upload` e outros.

## AuditLogController

Base route:

```txt
/audit-log
```

Rotas:

| Método | Rota | Responsabilidade |
|---|---|---|
| `GET` | `/audit-log` | Listar logs com filtros e paginação |
| `GET` | `/audit-log/stats` | Obter estatísticas rápidas |
| `GET` | `/audit-log/:entidade/:registroId` | Obter histórico de um registro |

Todas as rotas são restritas a `ADMIN`.

## AuditLogService

Métodos principais:

| Método | Responsabilidade |
|---|---|
| `registrar()` | Persistir evento de auditoria |
| `findAll()` | Listar logs paginados com filtros |
| `findByRegistro()` | Buscar histórico por entidade e registro |
| `stats()` | Calcular total, logs de hoje e top ações |
| `serializarSeguro()` | Converter snapshots para JSON seguro |
| `normalizarParaJson()` | Normalizar tipos complexos recursivamente |
| `midnightBrasilia()` | Calcular início do dia em Brasília |

## Registro de Auditoria

Fluxo:

```txt
Service de domínio chama auditLogService.registrar(opts)
  ↓
AuditLogService normaliza oldValue/newValue
  ↓
Prisma cria registro AuditLog
  ↓
Falha é capturada e registrada como warning
```

## Consulta de Logs

`findAll()` monta `where` tipado com `Prisma.AuditLogWhereInput`.

Filtros suportados:

- entidade;
- registroId;
- autorId;
- ação;
- data inicial;
- data final.

Usa `Promise.all()` para buscar dados e total em paralelo.

## Estatísticas

`stats()` retorna:

- total de logs;
- logs de hoje;
- top ações.

O cálculo de hoje usa fuso de Brasília (`America/Sao_Paulo`) para evitar erro em servidores UTC.

---

# 4. Dicionário Técnico

## Campos de Auditoria

| Campo | Objetivo |
|---|---|
| `entidade` | Nome da entidade afetada |
| `registroId` | ID do registro afetado |
| `acao` | Tipo de ação executada |
| `autorId` | ID do usuário executor |
| `autorNome` | Nome do executor |
| `autorRole` | Perfil do executor |
| `ip` | IP da requisição |
| `userAgent` | Navegador/agente HTTP |
| `oldValue` | Snapshot anterior |
| `newValue` | Snapshot novo |

## DTOs e Interfaces

| Estrutura | Responsabilidade |
|---|---|
| `QueryAuditDto` | Validar filtros de consulta |
| `AuditOptions` | Contrato para registrar auditoria |

## Validações de Query

| Campo | Validação |
|---|---|
| `page` | inteiro, mínimo 1, máximo 10000 |
| `limit` | inteiro, mínimo 1, máximo 100 |
| `entidade` | string opcional |
| `registroId` | string opcional |
| `autorId` | string opcional |
| `acao` | enum `AuditAcao` |
| `de` | data ISO opcional |
| `ate` | data ISO opcional |

---

# 5. Serviços e Integrações

## Banco de Dados

Model principal:

```txt
AuditLog
```

Operações Prisma usadas:

- `create`;
- `findMany`;
- `count`;
- `groupBy`.

## Integração com Outros Módulos

`AuditLogService` é consumido por módulos que precisam registrar ações sensíveis.

Exemplos:

- `UsersService`;
- `BeneficiariesService`;
- `TurmasService`;
- `FrequenciasService`;
- `ComunicadosService`;
- `UploadService`;
- `CertificadosService`.

## Common/AuditInterceptor

O módulo também é usado pelo `AuditInterceptor`, que registra mutações automaticamente quando a rota não usa `@SkipAudit()`.

---

# 6. Segurança e Qualidade

## Segurança

Pontos fortes:

- consulta de logs restrita a `ADMIN`;
- auditoria registra IP e user agent;
- snapshots são serializados com segurança;
- falhas de auditoria não vazam detalhes para o cliente;
- valores não serializáveis são convertidos para marcadores textuais;
- referências circulares são tratadas;
- dados binários são resumidos.

## Qualidade

Pontos positivos:

- service exportável e reutilizável;
- filtros de consulta tipados;
- paginação e limite máximo;
- estatísticas rápidas separadas;
- cálculo de data corrigido para Brasília;
- `serializarSeguro()` é estático e evita recriação de closure.

## Performance

- consultas usam paginação;
- `findAll()` usa `Promise.all()` para logs e total;
- `stats()` usa `Promise.all()` para contagens e agrupamento;
- `findByRegistro()` limita histórico a 50 entradas;
- serialização segura evita falhas em objetos complexos.

---

# 7. Regras de Negócio

- auditoria deve ser consultada apenas por ADMIN;
- registro de auditoria não deve interromper fluxo principal;
- logs devem conter entidade e ação;
- snapshots devem ser serializáveis para JSON;
- histórico por registro retorna no máximo 50 entradas;
- listagem tem limite máximo de 100 por página;
- estatística de logs do dia deve considerar o fuso de Brasília.

---

# 8. Pontos de Atenção

## Riscos

- Auditoria tolerante a falhas pode esconder problemas se warnings não forem monitorados.
- `autorRole` aceita string para compatibilidade, o que é prático, mas menos rígido do que enum puro.
- Snapshots podem conter dados sensíveis se o módulo chamador não sanitizar antes.
- Listagem com `page` até 10000 pode permitir offsets altos; deve ser monitorado em bases grandes.

## Débitos Técnicos

- Criar testes unitários para `serializarSeguro()`.
- Criar testes de `midnightBrasilia()`.
- Adicionar monitoramento para falhas de auditoria.
- Avaliar política de retenção de logs.
- Avaliar índices adicionais conforme volume.

## Melhorias Futuras

- Correlation ID por requisição;
- exportação de logs para CSV;
- filtros por `autorRole`;
- dashboard avançado de auditoria;
- alertas para ações sensíveis;
- retenção/arquivamento automático.

---

# 9. Relação com Outros Módulos

| Módulo | Relação |
|---|---|
| `PrismaModule` | Persistência dos logs |
| `Common/AuditInterceptor` | Auditoria automática |
| `Common/getAuditUser` | Dados do autor em auditoria manual |
| `UsersModule` | Auditoria de usuários |
| `UploadModule` | Auditoria de arquivos |
| `Auth/RBAC` | Restringe consulta a ADMIN |
| Frontend Admin | Consome listagem, histórico e estatísticas |

---

# 10. Resumo Técnico Final

O módulo `AuditLog` é a base de rastreabilidade da Braille API.

Ele permite registrar ações sensíveis, consultar logs com filtros, buscar histórico de registros e gerar estatísticas rápidas.

Criticidade: muito alta.

Complexidade: média/alta.

A implementação é profissional, com tolerância a falhas, serialização segura, paginação, RBAC e correção de fuso horário para estatísticas. Os principais próximos passos são monitoramento de falhas, política de retenção e testes unitários dos helpers de serialização/data.
