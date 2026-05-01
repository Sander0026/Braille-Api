# 45 — Frequências: Visão Geral do Módulo (`src/frequencias/`)

---

# 1. Visão Geral

O módulo `Frequencias` é responsável pela gestão de chamadas/aulas, presença, faltas, faltas justificadas, fechamento de diário e relatórios de presença dos alunos nas turmas/oficinas.

Arquivos principais:

```txt
src/frequencias/frequencias.module.ts
src/frequencias/frequencias.controller.ts
src/frequencias/frequencias.service.ts
src/frequencias/dto/create-frequencia.dto.ts
src/frequencias/dto/create-frequencia-lote.dto.ts
src/frequencias/dto/update-frequencia.dto.ts
src/frequencias/dto/query-frequencia.dto.ts
```

Responsabilidades principais:

- registrar chamada individual;
- registrar/atualizar chamada em lote;
- sincronizar campo oficial `status` com campo legado `presente`;
- listar frequências com filtros;
- listar resumo agrupado por turma/data;
- calcular relatório de presença por aluno/turma;
- editar frequência;
- remover frequência;
- fechar diário de uma data/turma;
- reabrir diário para retificação;
- bloquear alteração em diário fechado;
- controlar lançamento retroativo por role e variável de ambiente;
- aplicar autojustificativa por atestado ativo;
- registrar auditoria manual/background nas operações em lote.

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- NestJS Module Pattern;
- Controller-Service Pattern;
- Service Layer;
- DTO Pattern;
- RBAC;
- Manual Audit Pattern;
- Batch Upsert Pattern;
- Transaction Pattern;
- Legacy Compatibility Pattern;
- Diário Lock Pattern;
- Report Aggregation Pattern;
- Defensive Error Handling.

## Justificativa Técnica

Frequência é uma regra acadêmica crítica. O módulo precisa impedir duplicidade de chamada, preservar faltas justificadas, bloquear alteração de diário fechado e permitir retificação controlada.

O lote usa transação para garantir integridade atômica e reduzir o número de conexões, evitando uma operação por aluno fora de transação.

A compatibilidade entre `status` e `presente` permite migração gradual do frontend legado para o enum oficial.

---

# 3. FrequenciasModule

Importa:

- `AuditLogModule`;
- `ConfigModule`.

Declara:

- `FrequenciasController`;
- `FrequenciasService`.

O `ConfigModule` é usado pelo service para ler:

```txt
FREQUENCIAS_PERMITIR_RETROATIVAS
```

---

# 4. FrequenciasController

Base route:

```txt
/frequencias
```

Decorators principais:

```txt
@ApiTags('Frequências (Chamadas)')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@SkipAudit()
@Controller('frequencias')
```

Rotas principais:

| Método | Rota | Perfil | Responsabilidade |
|---|---|---|---|
| `POST` | `/frequencias` | ADMIN/SECRETARIA/PROFESSOR | Registrar chamada individual |
| `POST` | `/frequencias/lote` | ADMIN/SECRETARIA/PROFESSOR | Registrar/atualizar chamada em lote |
| `GET` | `/frequencias` | ADMIN/SECRETARIA/PROFESSOR | Listar chamadas |
| `GET` | `/frequencias/resumo` | ADMIN/SECRETARIA/PROFESSOR | Resumo agrupado por aula |
| `GET` | `/frequencias/relatorio/turma/:turmaId/aluno/:alunoId` | ADMIN/SECRETARIA/PROFESSOR | Relatório do aluno |
| `GET` | `/frequencias/:id` | ADMIN/SECRETARIA/PROFESSOR | Ver chamada específica |
| `PATCH` | `/frequencias/:id` | ADMIN/SECRETARIA/PROFESSOR | Editar chamada |
| `DELETE` | `/frequencias/:id` | ADMIN/SECRETARIA | Remover chamada |
| `POST` | `/frequencias/diario/fechar/:turmaId/:dataAula` | ADMIN/SECRETARIA/PROFESSOR | Fechar diário |
| `POST` | `/frequencias/diario/reabrir/:turmaId/:dataAula` | ADMIN/SECRETARIA | Reabrir diário |

---

# 5. FrequenciasService

Métodos principais:

| Método | Responsabilidade |
|---|---|
| `create()` | Registrar chamada individual |
| `salvarLote()` | Registrar/atualizar chamada em lote transacional |
| `findAll()` | Listar frequências com filtros |
| `findResumo()` | Agrupar chamadas por turma/data |
| `getRelatorioAluno()` | Calcular presenças/faltas por aluno/turma |
| `findOne()` | Buscar chamada específica |
| `update()` | Editar chamada |
| `remove()` | Remover chamada |
| `fecharDiario()` | Fechar diário da turma/data |
| `reabrirDiario()` | Reabrir diário para retificação |

Helpers:

| Helper | Responsabilidade |
|---|---|
| `ehHoje()` | Comparar data da aula com hoje em UTC |
| `statusFromPresente()` | Converter boolean legado para enum |
| `presenteFromStatus()` | Derivar boolean legado do enum |
| `resolverStatus()` | Resolver status oficial com fallback legado |
| `permiteFrequenciaRetroativa()` | Ler regra de retroatividade do ambiente |
| `validarDataHoje()` | Bloquear retroatividade quando aplicável |
| `verificarDiarioAberto()` | Bloquear alterações em diário fechado |

---

# 6. Status Oficial e Campo Legado

## Campo oficial

```txt
status: StatusFrequencia
```

Exemplos de status:

- `PRESENTE`;
- `FALTA`;
- `FALTA_JUSTIFICADA`.

## Campo legado

```txt
presente: boolean
```

Mantido por compatibilidade com frontend atual.

Regras:

- `status` é preferencial;
- `presente` é fallback legado;
- toda escrita mantém os dois sincronizados;
- `PRESENTE` gera `presente = true`;
- qualquer status diferente de `PRESENTE` gera `presente = false`.

---

# 7. Frequência Individual

Método:

```txt
create(dto, auditUser)
```

Fluxo:

1. converte `dataAula` para `Date`;
2. resolve role do usuário;
3. resolve `status` usando enum ou `presente` legado;
4. valida lançamento retroativo;
5. verifica se diário está aberto;
6. busca chamada existente para aluno/turma/data;
7. se existir, lança `ConflictException`;
8. cria registro de frequência.

---

# 8. Frequência em Lote

Método:

```txt
salvarLote(dto, auditUser)
```

Características:

- usa transação Prisma;
- pré-carrega frequências existentes;
- cria ou atualiza registros por aluno;
- preserva `FALTA_JUSTIFICADA` existente;
- aplica autojustificativa se houver atestado cobrindo a data;
- coleta payloads de auditoria;
- dispara auditoria em background após transação;
- usa timeout maior para evitar erro de transação longa.

Retorno:

```txt
sucesso: true
processados: number
mensagem: string
```

---

# 9. Diário Fechado

## Fechamento

Endpoint:

```txt
POST /frequencias/diario/fechar/:turmaId/:dataAula
```

Regras:

- professor só fecha diário do dia atual;
- admin pode fechar qualquer data;
- precisa haver registros para fechar;
- se todos já estão fechados, retorna erro;
- marca todos registros da turma/data como `fechado = true`;
- grava `fechadoEm` e `fechadoPor`.

## Reabertura

Endpoint:

```txt
POST /frequencias/diario/reabrir/:turmaId/:dataAula
```

Regras:

- apenas admin reabre;
- marca `fechado = false`;
- limpa `fechadoEm`;
- limpa `fechadoPor`.

Ponto de atenção: o controller permite ADMIN e SECRETARIA na rota, mas o service exige `Role.ADMIN` para reabrir.

---

# 10. Retroatividade

Variável:

```txt
FREQUENCIAS_PERMITIR_RETROATIVAS
```

Regra padrão:

```txt
true
```

Se o valor for `false`:

- professores e perfis não-admin só operam chamadas do dia atual;
- admin pode retificar qualquer data.

---

# 11. Relatórios e Resumos

## `findAll()`

Filtros:

- turma;
- aluno;
- data;
- professor.

Inclui dados mínimos de aluno e turma.

## `findResumo()`

Agrupa por:

- `dataAula`;
- `turmaId`.

Calcula:

- total de registros;
- presentes;
- faltas;
- diário fechado;
- nome da turma.

Evita N+1 com mapas em memória.

## `getRelatorioAluno()`

Retorna:

- total de aulas;
- presentes;
- faltas;
- faltas justificadas;
- taxa de presença;
- histórico completo.

---

# 12. Segurança e Qualidade

## Segurança

- rotas protegidas por JWT;
- delete restrito a ADMIN/SECRETARIA;
- reabertura efetiva restrita a ADMIN no service;
- diário fechado bloqueia alterações não-admin;
- retroatividade pode ser bloqueada por ambiente;
- erro crítico de lote não vaza detalhes nativos do banco;
- lote usa transação.

## Qualidade

- DTOs suportam migração de legado para enum oficial;
- lote evita O(N) conexões;
- resumo evita N+1;
- autojustificativa por atestado reduz trabalho manual;
- auditoria em background evita esgotar pool durante transação.

## Performance

- `findAll()` usa paginação;
- `findAll()` usa `Promise.all()`;
- lote pré-carrega registros existentes;
- resumo usa agrupamento e mapas;
- auditoria do lote roda após transação.

---

# 13. Pontos de Atenção

- `create()`, `update()`, `remove()`, `fecharDiario()` e `reabrirDiario()` não registram auditoria manual explícita, apesar do controller usar `@SkipAudit()`.
- `reabrirDiario` no controller permite SECRETARIA, mas o service bloqueia qualquer role diferente de ADMIN.
- `ehHoje()` compara em UTC, enquanto o usuário opera no Brasil; isso pode exigir revisão de fuso.
- `findResumo()` pagina agrupamento em memória após `groupBy`; em alto volume pode ser otimizado.
- `dadosParaAtualizar: any` pode ser tipado melhor.

---

# 14. Melhorias Futuras

- Auditar fechamento/reabertura de diário;
- auditar create/update/delete individual;
- padronizar permissão de reabertura entre controller e service;
- revisar `ehHoje()` para fuso `America/Sao_Paulo`;
- otimizar paginação de agrupamentos;
- remover campo legado `presente` após migração total do frontend;
- criar testes e2e de diário fechado e retroatividade.

---

# 15. Resumo Técnico Final

O módulo `Frequencias` é crítico para a operação pedagógica e acadêmica.

Ele controla chamadas individuais e em lote, diário fechado, retroatividade, faltas justificadas e relatórios de presença.

Criticidade: muito alta.

Complexidade: muito alta.

A implementação é profissional, especialmente no lote transacional, preservação de falta justificada e resumo otimizado. Os principais pontos de evolução são auditoria das operações individuais/diário, alinhamento de permissão de reabertura e revisão de fuso horário.
