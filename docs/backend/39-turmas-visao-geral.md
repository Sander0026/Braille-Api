# 39 — Turmas: Visão Geral do Módulo (`src/turmas/`)

---

# 1. Visão Geral

## Objetivo

Documentar a visão geral do módulo `Turmas`, responsável pela gestão de turmas/oficinas, horários, professores, matrículas de alunos e ciclo de vida acadêmico na Braille API.

Arquivos principais:

```txt
src/turmas/turmas.module.ts
src/turmas/turmas.controller.ts
src/turmas/turmas.service.ts
src/turmas/turmas.scheduler.ts
src/turmas/dto/create-turma.dto.ts
src/turmas/dto/update-turma.dto.ts
src/turmas/dto/query-turma.dto.ts
src/turmas/entities/turma.entity.ts
```

## Responsabilidade

O módulo `Turmas` é responsável por:

- criar turmas/oficinas;
- vincular professor responsável;
- configurar grade horária estruturada;
- calcular carga horária total;
- validar colisão de horário do professor;
- validar colisão de horário do aluno;
- listar turmas com filtros e cache;
- consultar detalhes da turma com alunos matriculados;
- listar professores ativos vinculados a turmas;
- listar alunos disponíveis para matrícula;
- matricular aluno em turma;
- desmatricular aluno;
- controlar capacidade máxima;
- mudar status acadêmico da turma;
- cancelar/concluir turma por atalhos;
- arquivar, restaurar e ocultar turmas;
- atualizar status automaticamente por data via scheduler;
- registrar auditoria manual.

## Perfis de Acesso

Leitura de turmas:

```txt
ADMIN
SECRETARIA
PROFESSOR
```

Operações administrativas:

```txt
ADMIN
SECRETARIA
```

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- NestJS Module Pattern;
- Controller-Service Pattern;
- Service Layer;
- DTO Pattern;
- RBAC;
- Manual Audit Pattern;
- Scheduler/Cron Pattern;
- Cache Interceptor Pattern;
- State Machine Pattern;
- Transaction Pattern;
- Conflict Detection Pattern;
- Soft Archive Pattern.

## Justificativa Técnica

Turmas possuem regras acadêmicas críticas: horários não podem colidir, professores não podem estar em duas turmas no mesmo horário, alunos não podem ser matriculados em turmas conflitantes e status acadêmicos precisam seguir transições válidas.

Por isso, o service concentra validações e usa transações quando mudanças de turma também impactam matrículas.

O controller usa `@SkipAudit()` e o service registra auditoria manual para ter snapshots mais precisos.

---

# 3. Fluxo Interno do Código

## TurmasModule

Importa:

- `AuditLogModule`.

Declara:

- `TurmasController`;
- `TurmasService`;
- `TurmasScheduler`.

## TurmasController

Base route:

```txt
/turmas
```

Rotas principais:

| Método | Rota | Perfil | Responsabilidade |
|---|---|---|---|
| `POST` | `/turmas` | ADMIN/SECRETARIA | Criar turma |
| `GET` | `/turmas` | ADMIN/SECRETARIA/PROFESSOR | Listar turmas |
| `GET` | `/turmas/professores-ativos` | ADMIN/SECRETARIA/PROFESSOR | Listar professores com turma ativa |
| `GET` | `/turmas/:id/alunos-disponiveis` | ADMIN/SECRETARIA | Listar alunos sem choque de horário |
| `GET` | `/turmas/:id` | ADMIN/SECRETARIA/PROFESSOR | Detalhar turma |
| `PATCH` | `/turmas/:id` | ADMIN/SECRETARIA | Atualizar turma |
| `PATCH` | `/turmas/:id/status` | ADMIN/SECRETARIA | Mudar status acadêmico |
| `DELETE` | `/turmas/:id` | ADMIN/SECRETARIA | Arquivar turma |
| `PATCH` | `/turmas/:id/restaurar` | ADMIN/SECRETARIA | Restaurar turma |
| `PATCH` | `/turmas/:id/ocultar` | ADMIN/SECRETARIA | Ocultar turma arquivada |
| `POST` | `/turmas/:id/alunos/:alunoId` | ADMIN/SECRETARIA | Matricular aluno |
| `DELETE` | `/turmas/:id/alunos/:alunoId` | ADMIN/SECRETARIA | Desmatricular aluno |
| `PATCH` | `/turmas/:id/cancelar` | ADMIN/SECRETARIA | Cancelar turma |
| `PATCH` | `/turmas/:id/concluir` | ADMIN/SECRETARIA | Concluir turma |

## TurmasService

Métodos principais:

| Método | Responsabilidade |
|---|---|
| `create()` | Criar turma com professor e grade |
| `findAll()` | Listar turmas com filtros |
| `findProfessoresAtivos()` | Listar professores vinculados a turmas |
| `update()` | Atualizar turma/grade/status |
| `arquivar()` | Arquivar turma |
| `restaurar()` | Restaurar turma |
| `ocultar()` | Ocultar turma arquivada |
| `addAluno()` | Matricular aluno |
| `removeAluno()` | Cancelar matrícula ativa |
| `findOne()` | Buscar turma com alunos |
| `findAlunosDisponiveis()` | Listar alunos sem conflito |
| `mudarStatus()` | Alterar status acadêmico validado |
| `cancelar()` | Atalho para status CANCELADA |
| `concluir()` | Atalho para status CONCLUIDA |

## TurmasScheduler

Executa diariamente:

```txt
0 0 * * *
```

Time zone:

```txt
America/Sao_Paulo
```

Responsável por:

- mudar `PREVISTA → ANDAMENTO` quando `dataInicio <= hoje`;
- mudar `ANDAMENTO → CONCLUIDA` quando `dataFim < hoje`.

---

# 4. Regras de Grade Horária

## Estrutura

A grade usa minutos desde meia-noite.

Exemplo:

```txt
14:00 → 840
16:00 → 960
```

Cada item contém:

- `dia`;
- `horaInicio`;
- `horaFim`.

## Validações

O service valida:

- horários precisam ser inteiros;
- início deve ser menor que fim;
- início mínimo 0;
- fim máximo 1440;
- não pode haver sobreposição dentro da própria turma;
- professor não pode ter outra turma ativa no mesmo dia/horário;
- aluno não pode ser matriculado em turma com choque de horário.

---

# 5. Ciclo de Vida da Turma

## Status Acadêmico

Enum principal:

```txt
TurmaStatus
```

Estados:

- `PREVISTA`;
- `ANDAMENTO`;
- `CONCLUIDA`;
- `CANCELADA`.

## Transições Permitidas

| Status atual | Pode ir para |
|---|---|
| `PREVISTA` | `ANDAMENTO`, `CANCELADA` |
| `ANDAMENTO` | `CONCLUIDA`, `CANCELADA` |
| `CONCLUIDA` | nenhuma |
| `CANCELADA` | `PREVISTA` |

## Impacto em Matrículas

Quando turma vira:

- `CONCLUIDA`: matrículas ativas viram `CONCLUIDA`;
- `CANCELADA`: matrículas ativas viram `CANCELADA`;
- `PREVISTA` ou `ANDAMENTO`: matrículas não são encerradas automaticamente.

---

# 6. Dicionário Técnico

## DTOs

| DTO | Responsabilidade |
|---|---|
| `CreateTurmaDto` | Criar turma |
| `GradeHorariaDto` | Representar horário semanal |
| `UpdateTurmaDto` | Atualização parcial |
| `QueryTurmaDto` | Filtros e paginação |
| `MudarStatusDto` | Body interno para troca de status |

## Models Envolvidos

| Model | Uso |
|---|---|
| `Turma` | Entidade principal |
| `GradeHoraria` | Horários semanais |
| `User` | Professor responsável |
| `Aluno` | Aluno matriculável |
| `MatriculaOficina` | Vínculo aluno-turma |
| `AuditLog` | Auditoria de mutações |

## Funções Auxiliares

| Função | Objetivo |
|---|---|
| `intervalosColidem()` | Detectar sobreposição de horários |
| `minutosParaHora()` | Formatar minutos em `HH:mm` |
| `calcularCargaHorariaTotal()` | Calcular carga horária pela grade e datas |
| `validarGradeHoraria()` | Validar grade interna |
| `validarColisaoProfessor()` | Bloquear choque do professor |
| `validarColisaoAluno()` | Bloquear choque do aluno |
| `validarTransicaoStatus()` | Validar máquina de estados |

---

# 7. Segurança e Qualidade

## Segurança

Pontos fortes:

- rotas protegidas por JWT;
- mutações restritas a ADMIN/SECRETARIA;
- leitura restrita a perfis internos;
- auditoria manual nas mutações;
- validação de colisão de horários;
- transições de status controladas;
- transações ao atualizar status e matrículas;
- proteção contra vazamento técnico com mensagens públicas.

## Qualidade

Pontos positivos:

- controller fino;
- service concentra regras acadêmicas;
- cache em consultas de leitura;
- scheduler automatiza ciclo de vida;
- filtros e paginação em listagem;
- validações de horário com mensagens claras;
- includes/selects estruturados para retorno útil ao frontend.

## Performance

- listagem usa paginação;
- `findAll()` usa `Promise.all()`;
- cache de 30 segundos em consultas frequentes;
- validação de alunos disponíveis filtra no banco com `none`;
- scheduler usa `updateMany`.

---

# 8. Regras de Negócio

- turma precisa ter professor válido;
- professor não pode ter choque de horário;
- aluno não pode ser matriculado duas vezes na mesma turma;
- aluno não pode ter choque de horário com turma ativa;
- capacidade máxima deve ser respeitada;
- grade não pode ter horários inválidos ou sobrepostos;
- status acadêmico só muda por transições permitidas;
- concluir/cancelar turma encerra matrículas ativas;
- arquivar preserva dados;
- ocultar marca `excluido = true` e `statusAtivo = false`;
- scheduler atualiza status conforme datas.

---

# 9. Pontos de Atenção

## Riscos

- `findAll()` usa `whereCondicao: any`; pode ser tipado com Prisma.
- `create()` e `update()` usam alguns casts `any` por causa de grade/carga horária.
- Scheduler altera status de turmas sem registrar auditoria.
- Cache em consultas pode mostrar dados defasados por alguns segundos após mutações.
- `@SkipAudit()` exige auditoria manual em toda nova mutação.

## Débitos Técnicos

- Tipar filtros de turma com `Prisma.TurmaWhereInput`.
- Criar testes de colisão de horário.
- Criar testes de transição de status.
- Avaliar auditoria do scheduler.
- Criar invalidação explícita de cache após mutações.

## Melhorias Futuras

- Fila/evento para mudanças de status;
- calendário visual de conflitos;
- validação de feriados/recessos;
- histórico de status da turma;
- endpoint de disponibilidade por professor;
- auditoria específica para scheduler.

---

# 10. Resumo Técnico Final

O módulo `Turmas` é central para a operação acadêmica do sistema.

Ele gerencia turmas, professores, horários, matrículas, status acadêmico e automação de ciclo de vida.

Criticidade: muito alta.

Complexidade: muito alta.

A implementação está profissional, com validação de conflitos, transições controladas, cache de leitura, scheduler e auditoria manual. Os principais próximos passos são testes de conflitos/status, tipagem Prisma dos filtros e auditoria das alterações automáticas do scheduler.
