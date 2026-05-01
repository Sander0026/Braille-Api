# 41 — TurmasService (`src/turmas/turmas.service.ts`)

---

# 1. Visão Geral

O `TurmasService` concentra as regras de negócio do domínio de turmas/oficinas.

Responsabilidades principais:

- criar turma com professor e grade horária;
- validar professor existente;
- validar grade horária;
- impedir choque de horário do professor;
- impedir choque de horário do aluno;
- calcular carga horária total;
- listar turmas com filtros e paginação;
- listar professores ativos com turmas;
- consultar detalhe da turma com alunos ativos;
- listar alunos disponíveis para matrícula;
- atualizar turma, grade e status;
- arquivar, restaurar e ocultar turma;
- matricular e desmatricular alunos;
- controlar capacidade máxima;
- validar transições de status acadêmico;
- aplicar efeitos de status nas matrículas;
- registrar auditoria manual.

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- Service Layer;
- Prisma Repository Pattern;
- Manual Audit Pattern;
- Transaction Pattern;
- State Machine Pattern;
- Conflict Detection Pattern;
- Soft Archive Pattern;
- Enrollment Management Pattern;
- Defensive Error Handling.

## Justificativa Técnica

Turmas possuem regras críticas de domínio. Não basta gravar dados: é necessário impedir conflitos de horário, controlar capacidade, manter consistência entre turma e matrícula, validar ciclo de vida acadêmico e auditar alterações.

Por isso, o service concentra a regra de negócio e usa transações quando a atualização da turma também precisa atualizar matrículas relacionadas.

---

# 3. Dependências

| Dependência | Uso |
|---|---|
| `PrismaService` | Persistência de turmas, alunos, professores e matrículas |
| `AuditLogService` | Auditoria manual |
| `calcularCargaHorariaTotal` | Cálculo de carga horária pela grade e datas |

Enums usados:

- `AuditAcao`;
- `DiaSemana`;
- `MatriculaStatus`;
- `Role`;
- `TurmaStatus`.

---

# 4. Regras de Horário

Horários são representados em minutos desde meia-noite.

Exemplos:

```txt
08:00 → 480
14:00 → 840
16:00 → 960
24:00 → 1440
```

## `intervalosColidem()`

Retorna `true` quando dois intervalos se sobrepõem:

```txt
a.horaInicio < b.horaFim && b.horaInicio < a.horaFim
```

## `validarGradeHoraria()`

Valida:

- `horaInicio` e `horaFim` são inteiros;
- início maior ou igual a 0;
- fim menor ou igual a 1440;
- início menor que fim;
- não há sobreposição de horários dentro da própria grade.

## `validarColisaoProfessor()`

Busca turmas ativas e não excluídas do professor.

Bloqueia se a nova grade colidir com grade de outra turma do mesmo professor.

## `validarColisaoAluno()`

Busca matrículas ativas do aluno em outras turmas.

Bloqueia matrícula se houver choque entre a grade da turma destino e as grades das turmas já cursadas pelo aluno.

---

# 5. Métodos Principais

## `create()`

Fluxo:

1. separa grade, datas e carga horária;
2. valida professor existente;
3. valida grade horária;
4. valida colisão do professor;
5. converte datas;
6. calcula carga horária final quando possível;
7. cria turma e grade horária;
8. inclui professor no retorno;
9. registra auditoria `CRIAR`.

## `findAll()`

Lista turmas com filtros:

- `page`;
- `limit`;
- `nome`;
- `professorId`;
- `status`;
- `statusAtivo`;
- `excluido`.

Retorna `data` e `meta(total, page, lastPage)`.

## `findProfessoresAtivos()`

Lista professores ativos, não excluídos, com pelo menos uma turma não excluída.

## `update()`

Fluxo:

1. busca turma com grade atual;
2. define professor e grade considerados;
3. valida grade;
4. valida colisão do professor;
5. recalcula carga horária;
6. valida transição de status se status mudou;
7. resolve `statusAtivo` e status de matrículas;
8. executa transação;
9. atualiza turma;
10. se necessário, atualiza matrículas ativas;
11. registra auditoria `ATUALIZAR`.

## `arquivar()`

Marca:

```txt
statusAtivo = false
excluido = false
```

Registra auditoria `ARQUIVAR`.

## `restaurar()`

Marca:

```txt
statusAtivo = true
excluido = false
```

Registra auditoria `RESTAURAR`.

## `ocultar()`

Marca:

```txt
excluido = true
statusAtivo = false
```

Registra auditoria `ARQUIVAR`.

## `addAluno()`

Fluxo:

1. busca turma com contagem de matrículas ativas e grade;
2. busca aluno;
3. verifica matrícula ativa duplicada na mesma turma;
4. valida capacidade máxima;
5. valida colisão de horário do aluno;
6. cria `MatriculaOficina`;
7. registra auditoria `CRIAR`.

## `removeAluno()`

Busca matrícula ativa do aluno na turma.

Atualiza:

```txt
status = CANCELADA
dataEncerramento = now
```

Registra auditoria `ATUALIZAR`.

## `findOne()`

Busca turma por ID incluindo professor, grade horária, matrículas ativas e dados mínimos do aluno.

## `findAlunosDisponiveis()`

Identifica turmas conflitantes por dia/horário e retorna alunos sem matrícula ativa nelas nem na turma destino.

---

# 6. Máquina de Estados

## Transições Permitidas

| Atual | Permitidos |
|---|---|
| `PREVISTA` | `ANDAMENTO`, `CANCELADA` |
| `ANDAMENTO` | `CONCLUIDA`, `CANCELADA` |
| `CONCLUIDA` | nenhuma |
| `CANCELADA` | `PREVISTA` |

## Impacto em Matrículas

Quando turma vira:

- `CONCLUIDA`: matrículas ativas viram `CONCLUIDA`;
- `CANCELADA`: matrículas ativas viram `CANCELADA`;
- outros status: não altera matrículas.

`aplicarTransicaoStatus()` executa transação para atualizar turma e matrículas relacionadas.

---

# 7. Auditoria

O service registra auditoria manual porque o controller usa `@SkipAudit()`.

Ações usadas:

| Operação | Ação |
|---|---|
| Criar turma | `CRIAR` |
| Atualizar turma | `ATUALIZAR` |
| Arquivar/Ocultar | `ARQUIVAR` |
| Restaurar | `RESTAURAR` |
| Matricular aluno | `CRIAR` |
| Desmatricular aluno | `ATUALIZAR` |
| Mudar status | `MUDAR_STATUS` |

---

# 8. Segurança e Qualidade

## Segurança

- valida professor existente;
- bloqueia horários inválidos;
- bloqueia colisão de professor;
- bloqueia colisão de aluno;
- bloqueia matrícula duplicada ativa;
- respeita capacidade máxima;
- controla transições de status;
- usa transações para status e matrículas;
- registra auditoria manual.

## Qualidade

- regras complexas isoladas no service;
- mensagens de erro claras;
- funções auxiliares coesas;
- transições centralizadas;
- status de matrícula derivado do status da turma.

---

# 9. Pontos de Atenção

- `findAll()` usa `whereCondicao: any`; pode ser tipado como `Prisma.TurmaWhereInput`.
- Alguns casts `any` aparecem em grade/cálculo de carga horária.
- Auditoria é tolerante a falhas; warnings precisam ser monitorados.
- Scheduler altera status sem auditoria neste service.
- Cache do controller pode ficar desatualizado após mutações.

---

# 10. Melhorias Futuras

- Tipar filtros com Prisma.
- Criar testes unitários de colisão de horário.
- Criar testes de transição de status.
- Adicionar auditoria para scheduler.
- Criar invalidação explícita de cache.
- Criar endpoint de disponibilidade por professor.
- Criar calendário consolidado de turmas.

---

# 11. Resumo Técnico Final

O `TurmasService` é o núcleo das regras acadêmicas de turmas.

Ele controla horários, professores, alunos, capacidade, status, matrículas e auditoria.

Criticidade: muito alta.

Complexidade: muito alta.

A implementação é profissional e defensiva. Os principais pontos de evolução são tipagem Prisma, testes de colisão/status, auditoria do scheduler e invalidação explícita de cache.
