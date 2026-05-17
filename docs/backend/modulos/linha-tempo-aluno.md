# Modulo: Linha do Tempo do Aluno

---

# 1. Visao Geral

A linha do tempo do aluno entrega uma visao unica dos fatos relevantes que aconteceram com o aluno
dentro da instituicao. Ela nao cria uma tabela nova nesta fase: o endpoint monta a resposta lendo as
tabelas existentes e normalizando tudo para um formato comum.

Essa escolha evita duplicacao de dados e reduz risco de inconsistencias. Se o volume crescer, o
proximo passo natural e criar uma tabela/cache de eventos materializados.

---

# 2. Onde Fica Cada Coisa

| Area | Arquivo | Papel |
|---|---|---|
| Modulo Nest | `src/aluno-linha-tempo/aluno-linha-tempo.module.ts` | Registra controller e service |
| Controller | `src/aluno-linha-tempo/aluno-linha-tempo.controller.ts` | Expoe `GET /beneficiaries/:id/linha-tempo` |
| Service | `src/aluno-linha-tempo/aluno-linha-tempo.service.ts` | Consulta tabelas existentes, aplica permissoes, ordena e pagina |
| DTO | `src/aluno-linha-tempo/dto/query-linha-tempo-aluno.dto.ts` | Filtros de data, tipo, turma e paginacao |
| Tipos | `src/aluno-linha-tempo/aluno-linha-tempo.types.ts` | `TipoEventoLinhaTempoAluno` e `LinhaTempoAlunoItem` |
| Registro global | `src/app.module.ts` | Importa `AlunoLinhaTempoModule` |

---

# 3. Endpoint

Base:

`GET /api/beneficiaries/:id/linha-tempo`

Query params:

| Parametro | Uso |
|---|---|
| `dataInicio` | Filtra eventos a partir da data informada |
| `dataFim` | Filtra eventos ate a data informada |
| `tipo` | Um tipo ou lista separada por virgula. Ex.: `PDI_CRIADO,PDI_EVOLUCAO` |
| `turmaId` | Restringe eventos vinculados a uma turma |
| `page` | Pagina da timeline |
| `limit` | Itens por pagina, maximo 100 |

---

# 4. Fontes de Eventos

O service agrega:

- `Aluno`: cadastro, inativacao e reativacao;
- `AuditLog`: atualizacoes cadastrais;
- `MatriculaOficina`: entrada e encerramento de matricula;
- `Frequencia`: presenca, falta e falta justificada;
- `AtendimentoIndividual`: atendimento realizado e falta em atendimento;
- `Atestado`: documento registrado e periodo coberto;
- `LaudoMedico`: laudo registrado, com detalhes sensiveis restritos;
- `CertificadoEmitido`: certificados academicos emitidos;
- `PdiAluno`, `PdiMeta`, `PdiEvolucao`: criacao de PDI, metas e evolucoes;
- `AcaoRiscoEvasao`: intervencoes criadas para risco de evasao.

Todos os eventos sao normalizados para `LinhaTempoAlunoItem`, ordenados do mais recente para o mais
antigo e paginados em memoria.

---

# 5. Permissoes

Roles permitidas:

- `ADMIN`
- `SECRETARIA`
- `PROFESSOR`

`COMUNICACAO` nao acessa linha do tempo individual.

Regras:

- Admin e Secretaria veem tudo.
- Professor so acessa alunos vinculados a suas turmas, atendimentos, acompanhamentos ou PDI sob sua responsabilidade.
- Laudos aparecem para professor apenas como evento sensivel, sem descricao clinica ou metadados detalhados.

---

# 6. Cuidados para Evolucao

- Se adicionar nova fonte de dados, crie um tipo em `aluno-linha-tempo.types.ts` e adicione o mapper no service.
- Evite retornar CPF, RG, endereco completo, URLs de laudo ou observacoes clinicas no `metadata`.
- Para volumes grandes, substitua a montagem em memoria por tabela materializada de eventos ou por queries paginadas por fonte com merge incremental.
