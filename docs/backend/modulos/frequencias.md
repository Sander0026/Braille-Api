# Módulo: Frequências

---

# 1. Visão Geral

## Objetivo
Gerenciar o registro de chamadas (presença/falta) dos alunos nas oficinas, o fechamento de diários de classe e a geração de relatórios de frequência por aluno ou turma.

## Responsabilidade
É o módulo de maior complexidade de regras de negócio operacionais. Controla: quem pode lançar chamadas, em quais datas, o que acontece com o diário após fechamento, e como atestados interagem automaticamente com faltas.

---

# 2. Arquitetura e Metodologias

## Padrões Identificados
- **State Machine (Diário):** diário aberto → fechado (só ADMIN reabre)
- **Upsert semântico no lote:** `salvarLote()` verifica existência e faz create/update dentro de uma única transação atômica
- **N+1 Prevention:** `findResumo()` usa `groupBy` + pré-carregamento de turmas em `Map` para evitar queries por item
- **Auto-justificativa:** ao lançar FALTA, o sistema verifica automaticamente atestados ativos e converte para `FALTA_JUSTIFICADA`
- **Legacy field sync:** campos `presente` (legado) e `status` (oficial) são sempre mantidos sincronizados

---

# 3. Fluxo Interno

## Lançamento Individual (`POST /api/frequencias`)
```
1. Converte dataAula para Date
2. Resolve status: prioriza dto.status, fallback para dto.presente (legado)
3. ADMIN: bypass de data; PROFESSOR: valida se é hoje (ou retroativo permitido)
4. Verifica se diário está fechado → ForbiddenException se não ADMIN
5. Verifica duplicata (mesma turma + aluno + data) → ConflictException
6. Cria registro sincronizando status + presente (legado)
```

## Lançamento em Lote (`POST /api/frequencias/lote`)
```
1. Uma transação Prisma para toda a chamada da turma (maxWait:10s, timeout:30s)
2. Pré-carrega todos os registros existentes em memória (Map) → O(1) por aluno
3. Para cada aluno no lote:
   a. Se registro existe e é FALTA_JUSTIFICADA → não sobrescreve (preserva atestado)
   b. Se existe e pode alterar → update
   c. Se não existe → create
   d. Se lançado como FALTA → verifica atestado ativo → converte para FALTA_JUSTIFICADA
4. Auditoria coletada durante transação → disparada sequencialmente no background após commit
```

**Por que auditoria fora da transação?** Chamar `registrar()` dentro da transação causaria contenção de conexão no pool do Prisma e risco de timeout. A auditoria é disparada como `Promise.resolve().then(async () => {...})` — no microtask queue, após commit.

## Fechamento de Diário (`POST /api/frequencias/diario/fechar/:turmaId/:data`)
```
1. PROFESSOR: só pode fechar o diário do dia atual
2. ADMIN: pode fechar qualquer data
3. Verifica registros existentes → BadRequest se nenhum
4. Verifica se já fechado → BadRequest
5. updateMany: fechado=true, fechadoEm=now(), fechadoPor=userId
```

## Reabertura de Diário (`POST /api/frequencias/diario/reabrir/:turmaId/:data`)
```
1. Apenas ADMIN pode reabrir
2. updateMany: fechado=false, fechadoEm=null, fechadoPor=null
```

---

# 4. Dicionário Técnico

## Helpers Privados Críticos

### `permiteFrequenciaRetroativa()`
```typescript
const valor = this.configService.get('FREQUENCIAS_PERMITIR_RETROATIVAS', 'true');
return valor !== 'false';
```
Controla se professores e secretaria podem lançar chamadas em datas passadas. Configurável por variável de ambiente sem redeploy. ADMIN sempre tem bypass.

### `resolverStatus(status?, presente?)`
Garante backward compatibility: se `status` foi enviado, usa ele; se não, converte `presente` boolean para `StatusFrequencia`. Falha explicitamente se nenhum dos dois for informado.

### `statusFromPresente(presente)` / `presenteFromStatus(status)`
Funções de sincronização bidirecional entre o campo legado `presente` (boolean) e o campo oficial `status` (enum). **Mantidos enquanto o campo legado existir.**

### `ehHoje(dataAula)`
Compara em UTC — evita falso positivo de timezone onde `getDate()` em servidor UTC pode diferir do dia local do usuário.

### `verificarDiarioAberto(turmaId, dataAula, role)`
Busca qualquer frequência da turma+data com `fechado: true`. Se encontrar e o usuário não for ADMIN → `ForbiddenException`.

---

# 5. Endpoints da API

| Método | Rota | Guard | Roles | Descrição |
|---|---|---|---|---|
| `POST` | `/api/frequencias` | `AuthGuard` | Todos | Lançar chamada individual |
| `POST` | `/api/frequencias/lote` | `AuthGuard` | Todos | Lançar chamada da turma inteira |
| `GET` | `/api/frequencias` | `AuthGuard` | Todos | Listar frequências (filtros) |
| `GET` | `/api/frequencias/resumo` | `AuthGuard` | Todos | Resumo agrupado por turma+data |
| `GET` | `/api/frequencias/relatorio/:turmaId/:alunoId` | `AuthGuard` | Todos | Relatório de frequência do aluno |
| `GET` | `/api/frequencias/:id` | `AuthGuard` | Todos | Buscar frequência individual |
| `PATCH` | `/api/frequencias/:id` | `AuthGuard` | Todos | Atualizar registro de chamada |
| `DELETE` | `/api/frequencias/:id` | `AuthGuard` | Todos | Remover registro |
| `POST` | `/api/frequencias/diario/fechar/:turmaId/:data` | `AuthGuard` | Todos | Fechar diário |
| `POST` | `/api/frequencias/diario/reabrir/:turmaId/:data` | `AuthGuard` | `ADMIN` | Reabrir diário |

---

# 6. Banco de Dados

## Tabela `Frequencia`

| Campo | Tipo | Descrição |
|---|---|---|
| `dataAula` | `@db.Date` | Data da aula (apenas data, sem hora) |
| `status` | `StatusFrequencia` | PRESENTE / FALTA / FALTA_JUSTIFICADA |
| `presente` | Boolean | ⚠️ Legado — sempre sincronizado com status |
| `fechado` | Boolean | Diário encerrado |
| `justificativaId` | UUID? | FK Atestado (auto-preenchida) |

**Unique:** `[dataAula, alunoId, turmaId]`

---

# 7. Regras de Negócio

1. **Um registro por aluno por turma por dia** — garantido por `@@unique` no schema
2. **FALTA_JUSTIFICADA é preservada:** lançar nova chamada sobre uma falta justificada não sobrescreve o atestado
3. **Auto-justificativa:** ao criar uma FALTA, o sistema verifica automaticamente se existe atestado cobrindo aquela data → converte para FALTA_JUSTIFICADA
4. **Diário fechado:** apenas ADMIN pode criar, editar ou deletar frequências em diário fechado
5. **Retroatividade configurável:** `FREQUENCIAS_PERMITIR_RETROATIVAS=false` restringe professores ao dia atual; ADMIN sempre pode retroativo
6. **Campo legado sincronizado:** toda escrita em `status` deve sincronizar `presente` (boolean) e vice-versa

---

# 8. Pontos de Atenção

> [!WARNING]
> **Tech Debt:** O campo `presente` (Boolean) é legado. Relatórios antigos podem dependê-lo. A remoção requer auditoria completa dos consumers antes de fazer a migration.

> [!NOTE]
> **Performance do lote:** A transação do `salvarLote()` tem timeout de 30s. Em turmas muito grandes (>200 alunos), monitorar o tempo de execução.

> [!IMPORTANT]
> **Auto-justificativa:** A lógica de verificar atestados dentro da transação do lote cria N queries adicionais (1 por aluno com FALTA). Em turmas grandes, isso pode impactar o tempo da transação.

---

# 9. Resumo Técnico Final

Módulo de alta complexidade operacional com regras de negócio sofisticadas: máquina de estados do diário, auto-justificativa por atestado, retroatividade configurável e transação atômica de lote com auditoria assíncrona. É o módulo mais usado no dia a dia da instituição pelos professores.

**Criticidade:** 🔴 Alta | **Complexidade:** Alta | **Testes:** `frequencias.service.spec.ts`, `frequencias.controller.spec.ts`
