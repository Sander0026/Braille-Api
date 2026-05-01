# 43 — Turmas: Matrículas, Horários e Status

---

# 1. Visão Geral

Este documento detalha as regras críticas do módulo `Turmas` relacionadas a:

- grade horária estruturada;
- colisão de horários;
- matrícula de alunos;
- desmatrícula;
- capacidade máxima;
- ciclo de vida acadêmico da turma;
- impacto do status da turma nas matrículas.

Arquivos relacionados:

```txt
src/turmas/turmas.service.ts
src/turmas/turmas.controller.ts
src/turmas/dto/create-turma.dto.ts
src/turmas/dto/query-turma.dto.ts
src/turmas/turmas.scheduler.ts
```

---

# 2. Grade Horária Estruturada

A grade horária da turma usa minutos desde meia-noite.

Exemplos:

```txt
00:00 → 0
08:00 → 480
14:00 → 840
16:00 → 960
24:00 → 1440
```

Cada horário contém:

```txt
dia
horaInicio
horaFim
```

Usar minutos evita ambiguidade de strings e facilita comparação, cálculo de carga horária, colisão e disponibilidade.

---

# 3. Validação de Horários

## `intervalosColidem()`

Dois intervalos colidem quando:

```txt
a.horaInicio < b.horaFim && b.horaInicio < a.horaFim
```

Exemplos:

| Horário A | Horário B | Colide? |
|---|---|---|
| 14:00–16:00 | 15:00–17:00 | Sim |
| 14:00–16:00 | 16:00–18:00 | Não |
| 14:00–16:00 | 13:00–15:00 | Sim |
| 14:00–16:00 | 14:00–16:00 | Sim |

## `validarGradeHoraria()`

Valida:

- `horaInicio` e `horaFim` são inteiros;
- `horaInicio >= 0`;
- `horaFim <= 1440`;
- `horaInicio < horaFim`;
- não há sobreposição dentro da própria turma no mesmo dia.

---

# 4. Colisão de Professor

Método:

```txt
validarColisaoProfessor(professorId, novosHorarios, turmaIdExcluir?)
```

Fluxo:

1. busca turmas do professor;
2. considera apenas turmas `statusAtivo = true` e `excluido = false`;
3. ignora a própria turma em atualização;
4. compara horários existentes com horários novos;
5. se houver colisão no mesmo dia, lança `BadRequestException`.

Regra: professor não pode ser alocado em duas turmas ativas no mesmo dia e horário.

---

# 5. Colisão de Aluno

Método:

```txt
validarColisaoAluno(alunoId, novosHorarios, turmaIdExcluir)
```

Fluxo:

1. busca matrículas ativas do aluno;
2. inclui a turma de cada matrícula com sua grade horária;
3. ignora a própria turma quando aplicável;
4. compara horários existentes com horários novos;
5. se houver colisão no mesmo dia, lança `BadRequestException`.

Regra: aluno não pode ser matriculado em turmas ativas com horários conflitantes.

---

# 6. Matrícula de Aluno

Endpoint:

```txt
POST /turmas/:id/alunos/:alunoId
```

Proteção:

```txt
ADMIN
SECRETARIA
```

Método:

```txt
addAluno(turmaId, alunoId, auditUser)
```

Fluxo:

1. busca turma com contagem de matrículas ativas e grade;
2. busca aluno;
3. verifica matrícula ativa duplicada na mesma turma;
4. valida capacidade máxima;
5. valida colisão de horário do aluno;
6. cria `MatriculaOficina`;
7. registra auditoria `CRIAR`.

---

# 7. Desmatrícula de Aluno

Endpoint:

```txt
DELETE /turmas/:id/alunos/:alunoId
```

Proteção:

```txt
ADMIN
SECRETARIA
```

Método:

```txt
removeAluno(turmaId, alunoId, auditUser)
```

Fluxo:

1. busca matrícula ativa do aluno na turma;
2. se não existir, lança `NotFoundException`;
3. marca matrícula como `CANCELADA`;
4. define `dataEncerramento = now`;
5. registra auditoria `ATUALIZAR`.

A desmatrícula preserva histórico acadêmico.

---

# 8. Capacidade Máxima

Campo:

```txt
capacidadeMaxima
```

Se `capacidadeMaxima` não for `null`, o service conta matrículas ativas da turma.

Se o total ativo for maior ou igual à capacidade, a matrícula é bloqueada.

---

# 9. Alunos Disponíveis

Endpoint:

```txt
GET /turmas/:id/alunos-disponiveis
```

Proteção:

```txt
ADMIN
SECRETARIA
```

Método:

```txt
findAlunosDisponiveis(turmaId, nome?)
```

Fluxo:

1. busca turma destino com grade;
2. busca turmas ativas com grade;
3. identifica turmas que conflitam com a grade destino;
4. adiciona a própria turma à lista de exclusão;
5. busca alunos que não possuem matrícula ativa nessas turmas;
6. aplica filtro por nome quando informado.

---

# 10. Máquina de Status da Turma

Estados:

- `PREVISTA`;
- `ANDAMENTO`;
- `CONCLUIDA`;
- `CANCELADA`.

Transições permitidas:

| Status atual | Pode ir para |
|---|---|
| `PREVISTA` | `ANDAMENTO`, `CANCELADA` |
| `ANDAMENTO` | `CONCLUIDA`, `CANCELADA` |
| `CONCLUIDA` | nenhuma |
| `CANCELADA` | `PREVISTA` |

Método:

```txt
validarTransicaoStatus(statusAtual, novoStatus)
```

Bloqueia qualquer transição não permitida.

---

# 11. Impacto do Status nas Matrículas

Quando turma muda para:

| Novo status da turma | Status aplicado às matrículas ativas |
|---|---|
| `CONCLUIDA` | `CONCLUIDA` |
| `CANCELADA` | `CANCELADA` |
| `PREVISTA` | Sem alteração automática |
| `ANDAMENTO` | Sem alteração automática |

`aplicarTransicaoStatus()` usa transação para atualizar turma e matrículas relacionadas.

---

# 12. Scheduler de Status

Arquivo:

```txt
src/turmas/turmas.scheduler.ts
```

Executa diariamente à meia-noite no fuso:

```txt
America/Sao_Paulo
```

Regras automáticas:

- `PREVISTA` com `dataInicio <= hoje` vira `ANDAMENTO`;
- `ANDAMENTO` com `dataFim < hoje` vira `CONCLUIDA`.

Ponto de atenção: o scheduler altera status via `updateMany` e não registra auditoria individual por turma.

---

# 13. Auditoria

Ações manuais registradas:

| Operação | Entidade | Ação |
|---|---|---|
| Matricular aluno | `MatriculaOficina` | `CRIAR` |
| Desmatricular aluno | `MatriculaOficina` | `ATUALIZAR` |
| Mudar status | `Turma` | `MUDAR_STATUS` |
| Cancelar/concluir | `Turma` | `MUDAR_STATUS` |
| Arquivar/ocultar | `Turma` | `ARQUIVAR` |
| Restaurar | `Turma` | `RESTAURAR` |

---

# 14. Segurança e Qualidade

## Segurança

- regras de matrícula ficam no backend;
- aluno não pode ser matriculado com choque de horário;
- professor não pode ter choque de horário;
- capacidade máxima é validada no backend;
- transições inválidas são bloqueadas;
- desmatrícula preserva histórico;
- mudanças críticas são auditadas.

## Qualidade

- validações possuem mensagens claras;
- regras de colisão são centralizadas;
- status tem máquina de estados explícita;
- transações evitam inconsistência;
- endpoints de atalho reduzem erro operacional.

---

# 15. Pontos de Atenção

- Scheduler não audita mudanças automáticas.
- Cache pode exibir dados antigos após mudança de status ou matrícula.
- Validações de colisão carregam grades existentes; pode exigir otimização em alto volume.
- Rematrícula futura pode exigir regras próprias além de cancelar/criar matrícula.

---

# 16. Melhorias Futuras

- Auditoria para scheduler;
- fila/evento para mudança automática de status;
- calendário visual de conflitos;
- endpoint de disponibilidade por professor;
- invalidação de cache após matrícula/status;
- histórico específico de status de turma;
- regras formais de rematrícula.

---

# 17. Resumo Técnico Final

As regras de matrículas, horários e status do módulo `Turmas` são críticas para a integridade acadêmica do sistema.

O backend valida conflitos, capacidade, status e efeitos em matrículas, evitando inconsistências operacionais.

Criticidade: muito alta.

Complexidade: muito alta.

A implementação é profissional e defensiva. Os principais próximos passos são auditoria do scheduler, testes de colisão/status e invalidação explícita de cache após alterações sensíveis.
