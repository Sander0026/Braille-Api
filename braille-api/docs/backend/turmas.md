# Modulo: Turmas

---

# 1. Visao Geral

## Objetivo

Documentar `src/turmas`, modulo de oficinas/turmas, grade horaria, matriculas e ciclo de vida academico.

## Responsabilidade

Criar turmas, listar, atualizar, arquivar/restaurar/ocultar, matricular/desmatricular alunos, validar choques de horario, controlar status academico e expor professores ativos.

## Fluxo de Funcionamento

Controllers protegidos por roles delegam a `TurmasService`. O service valida professor, calcula carga horaria, previne colisao de horarios para professor/aluno, controla capacidade maxima e registra auditoria. `TurmasScheduler` usa scheduler para automacoes de status.

---

# 2. Arquitetura e Metodologias

## Padroes Arquiteturais Identificados

* Service Layer.
* Transaction Script.
* State Machine para status.
* Domain Validation para horarios.
* Soft Delete.
* Scheduler Pattern.
* Guard/Role-based Access Control.

## Justificativa Tecnica

Turmas concentram regras academicas. Validar choque no service preserva consistencia independentemente do cliente. Transacoes protegem atualizacao de turma e encerramento de matriculas. A maquina de estados reduz transicoes invalidas.

---

# 3. Fluxo Interno do Codigo

## Fluxo de Execucao

1. Criacao verifica existencia do professor.
2. Se houver grade, valida colisao do professor.
3. Converte `dataInicio` e `dataFim`.
4. Calcula `cargaHoraria` quando ha periodo e grade.
5. Cria turma com `gradeHoraria.create`.
6. Atualizacao busca turma com grade atual.
7. Se grade mudou, recria a grade em transacao.
8. Se status muda para `CONCLUIDA` ou `CANCELADA`, atualiza matriculas ativas na mesma transacao.
9. Matricula de aluno valida aluno/turma, duplicidade ativa, capacidade e choque de horario.
10. Desmatricula atualizando status para `CANCELADA`.
11. `mudarStatus` valida transicao em `TRANSICOES_VALIDAS`.

## Dependencias Internas

* `PrismaService`
* `AuditLogService`
* `calcularCargaHorariaTotal`
* DTOs de turma

## Dependencias Externas

* `@prisma/client`
* `@nestjs/schedule`

---

# 4. Dicionario Tecnico

## Variaveis

* `TRANSICOES_VALIDAS`: mapa de ciclo de vida.
* `gradeHoraria`: lista de dias e horarios em minutos.
* `horaInicio`, `horaFim`: minutos desde meia-noite.
* `capacidadeMaxima`: limite de matriculas ativas.
* `statusAtivo`: arquivamento visual/operacional.
* `excluido`: ocultacao profunda.
* `modeloCertificadoId`: template usado para certificados.

## Funcoes e Metodos

* `intervalosColidem(a,b)`: detecta sobreposicao.
* `minutosParaHora(m)`: formata hora legivel.
* `create(dto, auditUser)`: cria turma.
* `findAll(query)`: lista com professor, grade e contagem de matriculas ativas.
* `findProfessoresAtivos()`: professores vinculados a turmas.
* `update(id,dto,auditUser)`: atualiza turma/grade/status/matriculas.
* `arquivar`, `restaurar`, `ocultar`, `remove`: ciclo de visibilidade.
* `addAluno(turmaId, alunoId, auditUser)`: matricula.
* `removeAluno(turmaId, alunoId, auditUser)`: cancela matricula ativa.
* `findOne(id)`: detalhe com professor, grade e alunos.
* `findAlunosDisponiveis(turmaId,nome)`: filtra alunos sem conflito.
* `validarColisaoAluno`: bloqueia aluno em horario sobreposto.
* `validarColisaoProfessor`: bloqueia professor em horario sobreposto.
* `mudarStatus`, `cancelar`, `concluir`: status academico.

## Classes

* `TurmasController`
* `TurmasService`
* `TurmasScheduler`
* `CreateTurmaDto`
* `GradeHorariaDto`
* `UpdateTurmaDto`
* `QueryTurmaDto`

## Interfaces e Tipagens

* `TurmaStatus`: `PREVISTA`, `ANDAMENTO`, `CONCLUIDA`, `CANCELADA`.
* `DiaSemana`: `SEG` a `DOM`.
* `MatriculaStatus`: `ATIVA`, `CONCLUIDA`, `EVADIDA`, `CANCELADA`.

---

# 5. Servicos e Integracoes

## APIs

* `POST /api/turmas`
* `GET /api/turmas`
* `GET /api/turmas/professores-ativos`
* `GET /api/turmas/:id/alunos-disponiveis`
* `GET /api/turmas/:id`
* `PATCH /api/turmas/:id`
* `PATCH /api/turmas/:id/status`
* `DELETE /api/turmas/:id`
* `PATCH /api/turmas/:id/restaurar`
* `PATCH /api/turmas/:id/ocultar`
* `POST /api/turmas/:id/alunos/:alunoId`
* `DELETE /api/turmas/:id/alunos/:alunoId`
* `PATCH /api/turmas/:id/cancelar`
* `PATCH /api/turmas/:id/concluir`

## Banco de Dados

Entidades `Turma`, `GradeHoraria`, `MatriculaOficina`, `Aluno`, `User`, `ModeloCertificado`.

## Servicos Externos

Nao integra servico externo diretamente.

---

# 6. Seguranca e Qualidade

## Seguranca

* Mutacoes restritas a `ADMIN` e `SECRETARIA`.
* Listagens tambem permitem `PROFESSOR` quando necessario.
* Auditoria registra criacao, atualizacao, matriculas e status.

## Qualidade

* Transacao em update garante turma e matriculas coerentes.
* Mensagens de choque de horario sao explicativas.
* `findAlunosDisponiveis` usa filtro SQL para evitar retorno de alunos conflitantes.

## Performance

* Listagem usa count e findMany paralelos.
* Colisao usa dados de grade em memoria apos busca.
* CacheInterceptor em rotas de listagem/detalhe.

---

# 7. Regras de Negocio

* Professor nao pode lecionar turmas ativas com horario sobreposto.
* Aluno nao pode se matricular em turmas ativas com horario sobreposto.
* Aluno nao pode ter matricula ativa duplicada na mesma turma.
* Capacidade maxima bloqueia novas matriculas.
* Status segue transicoes permitidas.
* Arquivar preserva dados; ocultar marca `excluido=true`.
* Concluir/cancelar turma pode encerrar matriculas ativas.

---

# 8. Pontos de Atencao Tratados

* `cancelar` e `concluir` agora delegam para a mesma maquina de estados usada por `mudarStatus`, bloqueando transicoes invalidas.
* Transicoes para `CONCLUIDA` e `CANCELADA` passaram a encerrar matriculas ativas na mesma transacao e ajustar `statusAtivo`.
* `GradeHoraria` ja permite multiplos turnos no mesmo dia via indices no schema, com validacao de sobreposicao no service.
* `findProfessoresAtivos` agora retorna apenas usuarios com role `PROFESSOR`, ativos e nao excluidos.

---

# 9. Relacao com Outros Modulos

* Depende de `Users` para professor.
* Depende de `Beneficiaries` para alunos.
* `Frequencias` depende de turmas.
* `Certificados` depende de turma concluida e modelo vinculado.
* `AuditLog` rastreia alteracoes.

---

# 10. Resumo Tecnico Final

Turmas e modulo de alta criticidade academica. A complexidade e alta por horarios, capacidade, matriculas, status e certificado. A implementacao e forte em validacoes de negocio, mas deve alinhar todos os atalhos de status a mesma maquina de estados.
