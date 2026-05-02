# Módulo: Turmas

---

# 1. Visão Geral

## Objetivo
Gerenciar as oficinas e cursos do instituto: criação com grade horária, validação de conflitos de horário, controle de matrículas de alunos, máquina de estados acadêmicos e scheduler automático de transição de status.

## Responsabilidade
É o núcleo organizacional acadêmico do sistema. Coordena a relação entre professores, alunos e horários, garantindo que não existam conflitos de disponibilidade.

---

# 2. Arquitetura e Metodologias

## Padrões Identificados
- **State Machine explícita:** `TRANSICOES_VALIDAS` define quais transições de status são permitidas
- **Scheduler Cron:** `TurmasScheduler` executa diariamente às 00:00 (Brasília) para auto-transicionar status
- **Collision Detection:** `validarColisaoProfessor()` e `validarColisaoAluno()` usando algoritmo de sobreposição de intervalos
- **Carga Horária Calculada:** `calcularCargaHorariaTotal()` itera dia a dia e acumula minutos por turno da grade
- **Surgical Select + `@SkipAudit()`:** auditoria feita manualmente no service

## Máquina de Estados

```
PREVISTA → ANDAMENTO → CONCLUIDA
         ↘ CANCELADA ↗
CANCELADA → PREVISTA (reativação)
CONCLUIDA → (terminal — sem transições)
```

```typescript
const TRANSICOES_VALIDAS: Record<TurmaStatus, TurmaStatus[]> = {
  PREVISTA:  ['ANDAMENTO', 'CANCELADA'],
  ANDAMENTO: ['CONCLUIDA', 'CANCELADA'],
  CONCLUIDA: [],         // Estado terminal
  CANCELADA: ['PREVISTA'],
};
```

---

# 3. Fluxo Interno

## Criação (`POST /api/turmas`)
```
1. Verifica existência do professor
2. Valida grade horária interna (hora início < hora fim, dias únicos)
3. Verifica colisão de horário do professor com outras turmas ATIVAS
4. Calcula carga horária total automaticamente (se datas + grade fornecidas)
5. Cria turma + gradeHoraria em uma única operação (nested create Prisma)
6. Registra auditoria de CRIAR manualmente
```

## Matrícula (`POST /api/turmas/:id/alunos/:alunoId`)
```
1. Verifica existência da turma e do aluno
2. Verifica se já existe matrícula ATIVA do aluno nessa turma
3. Verifica capacidade máxima (se configurada)
4. Verifica colisão de horário do aluno em outras turmas ATIVAS
5. Cria MatriculaOficina com status ATIVA
6. Registra auditoria MATRICULAR
```

## Desmatrícula (`DELETE /api/turmas/:id/alunos/:alunoId`)
```
1. Busca matrícula ATIVA do aluno na turma
2. Atualiza status → CANCELADA, preenche dataEncerramento
3. Registra auditoria DESMATRICULAR
```

## Scheduler Automático (`TurmasScheduler`)
```
Cron: '0 0 * * *' America/Sao_Paulo (00:00 todos os dias)
1. updateMany: PREVISTA → ANDAMENTO onde dataInicio <= hoje
2. updateMany: ANDAMENTO → CONCLUIDA onde dataFim < hoje
3. Erros fatais são capturados e logados sem derrubar o scheduler
```

## Algoritmo de Colisão de Horário

```typescript
// Dois intervalos colidem se:
function intervalosColidem(a, b): boolean {
  return a.horaInicio < b.horaFim && b.horaInicio < a.horaFim;
}
// Mesmo dia da semana + sobreposição de minutos = colisão
```

---

# 4. Dicionário Técnico

## Constante `TRANSICOES_VALIDAS`
Record que define as transições permitidas de `TurmaStatus`. Qualquer transição não listada lança `BadRequestException`.

## `calcularCargaHorariaTotal(dataInicio, dataFim, gradeHoraria)`
Arquivo: `src/common/helpers/data.helper.ts`
- Itera dia a dia entre as datas (inclusive)
- Para cada dia, verifica se o `getDay()` (0-6) está na grade
- Acumula minutos por turno; suporta múltiplos turnos no mesmo dia
- Retorna string legível: `"40 horas"`, `"2 horas e 30 minutos"`

## `minutosParaHora(m)`
Converte minutos inteiros para string legível: `840 → "14:00"`. Usado nas mensagens de erro de colisão.

## DTOs Principais

### `CreateTurmaDto`
```typescript
{
  nome: string;
  descricao?: string;
  professorId: string;
  capacidadeMaxima?: number;
  status?: TurmaStatus;
  dataInicio?: string;
  dataFim?: string;
  cargaHoraria?: string;   // Ignorado se dataInicio+dataFim+gradeHoraria forem fornecidos
  modeloCertificadoId?: string;
  gradeHoraria?: GradeHorariaDto[];
}
```

### `GradeHorariaDto`
```typescript
{ dia: DiaSemana; horaInicio: number; horaFim: number; }
// Horários em MINUTOS desde a meia-noite (ex: 840 = 14:00, 960 = 16:00)
```

---

# 5. Endpoints da API

| Método | Rota | Guard | Roles | Descrição |
|---|---|---|---|---|
| `POST` | `/api/turmas` | `AuthGuard` | `ADMIN, SECRETARIA` | Criar turma |
| `GET` | `/api/turmas` | `AuthGuard` | Todos | Listar turmas (filtros) |
| `GET` | `/api/turmas/:id` | `AuthGuard` | Todos | Detalhe da turma com alunos |
| `PATCH` | `/api/turmas/:id` | `AuthGuard` | `ADMIN, SECRETARIA` | Atualizar turma |
| `PATCH` | `/api/turmas/:id/status` | `AuthGuard` | `ADMIN, SECRETARIA` | Mudar status |
| `DELETE` | `/api/turmas/:id` | `AuthGuard` | `ADMIN` | Soft delete |
| `POST` | `/api/turmas/:id/alunos/:alunoId` | `AuthGuard` | `ADMIN, SECRETARIA` | Matricular aluno |
| `DELETE` | `/api/turmas/:id/alunos/:alunoId` | `AuthGuard` | `ADMIN, SECRETARIA` | Desmatricular aluno |
| `GET` | `/api/turmas/:id/alunos` | `AuthGuard` | Todos | Listar alunos matriculados |

---

# 6. Banco de Dados

## Tabelas Envolvidas
- `Turma`: entidade principal
- `GradeHoraria`: cascade delete com turma (`onDelete: Cascade`)
- `MatriculaOficina`: sem `@@unique` — valida unicidade de ATIVA no service
- `User` (professor): FK `professorId`

## Query de Colisão do Professor
```typescript
// Busca turmas ATIVAS do professor com grade horária no mesmo dia
where: {
  professorId,
  status: { in: ['PREVISTA', 'ANDAMENTO'] },
  gradeHoraria: { some: { dia: { in: diasNovaTurma } } }
}
// + filtro de sobreposição de intervalos em memória
```

---

# 7. Regras de Negócio

1. **Transições de status validadas:** nenhuma transição arbitrária é permitida
2. **Estado terminal `CONCLUIDA`:** turma concluída não pode mudar de status
3. **Colisão de professor:** professor não pode estar em duas turmas no mesmo dia/horário
4. **Colisão de aluno:** aluno matriculado não pode ter sobreposição de horário em outras turmas ATIVAS
5. **Capacidade máxima:** se configurada, impede matrícula acima do limite
6. **Carga horária automática:** calculada automaticamente se datas e grade forem fornecidas; o campo manual `cargaHoraria` do DTO é ignorado nesse caso
7. **Scheduler idempotente:** executar manualmente o método do scheduler produz o mesmo resultado que esperar o cron — sem efeitos colaterais

---

# 8. Pontos de Atenção

> [!WARNING]
> **Colisão em memória:** A detecção de colisão carrega todas as grades do professor em memória para verificação. Em casos de professor com muitas turmas, considerar otimização com query SQL.

> [!NOTE]
> **Scheduler e fuso:** O `@Cron('0 0 * * *', { timeZone: 'America/Sao_Paulo' })` garante execução à meia-noite de Brasília, mesmo em servidor UTC.

> [!IMPORTANT]
> **MatriculaOficina sem unique:** A constraint de unicidade de matrícula ATIVA é validada no service, não no banco. Se o service for burlado diretamente pelo banco, duplicatas são possíveis.

---

# 9. Resumo Técnico Final

Módulo de alta complexidade com algoritmos de detecção de colisão, máquina de estados explícita, scheduler automático e cálculo de carga horária. É o coração organizacional do sistema acadêmico.

**Criticidade:** 🔴 Alta | **Complexidade:** Alta | **Testes:** `turmas.service.spec.ts`, `turmas.controller.spec.ts`
