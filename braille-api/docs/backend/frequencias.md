# Modulo: Frequencias

---

# 1. Visao Geral

## Objetivo

Documentar `src/frequencias`, modulo de chamadas, presenca, faltas, justificativas e fechamento de diario.

## Responsabilidade

Registrar frequencias individuais e em lote, consultar chamadas, gerar resumo por aula, calcular relatorio de aluno, editar/remover registros e controlar diario fechado.

## Fluxo de Funcionamento

Rotas usam `AuthGuard` e `RolesGuard`. Professores, secretaria e admin podem registrar/listar; exclusao e reabertura sao restritas. O service aplica trava de diario fechado, preserva faltas justificadas, autojustifica faltas cobertas por atestado e usa transacao em lote.

---

# 2. Arquitetura e Metodologias

## Padroes Arquiteturais Identificados

* Transaction Script.
* Batch Upsert manual.
* Domain Lock por diario fechado.
* Query Aggregation.
* Audit Trail assincromo.

## Justificativa Tecnica

Frequencia e um fluxo sensivel porque impacta certificado e historico academico. A operacao em lote reduz chamadas do cliente e garante atomicidade. A trava de diario fechado cria marco de integridade apos revisao.

---

# 3. Fluxo Interno do Codigo

## Fluxo de Execucao

1. `create` converte `dataAula`, identifica role e verifica diario aberto.
2. Verifica duplicidade por aluno/turma/data.
3. Cria registro.
4. `salvarLote` converte data e abre transacao.
5. Precarrega frequencias existentes para alunos do lote.
6. Atualiza ou cria cada frequencia.
7. Se frequencia existente esta `FALTA_JUSTIFICADA`, nao sobrescreve.
8. Se aluno marcado ausente possui atestado cobrindo a data, altera para `FALTA_JUSTIFICADA`.
9. Coleta payloads de auditoria e registra apos a transacao.
10. `findResumo` agrupa por `dataAula` e `turmaId`, enriquece com nome da turma, presentes/faltas e status de fechamento.
11. `fecharDiario` marca todos os registros da turma/data como fechados.
12. `reabrirDiario` limpa flags de fechamento.

## Dependencias Internas

* `PrismaService`
* `AuditLogService`
* DTOs de frequencia

## Dependencias Externas

* `@prisma/client`

---

# 4. Dicionario Tecnico

## Variaveis

* `dataAula`: data da chamada, persistida como `@db.Date`.
* `presente`: boolean legado.
* `status`: enum `PRESENTE`, `FALTA`, `FALTA_JUSTIFICADA`.
* `fechado`: trava de diario.
* `fechadoEm`: timestamp do fechamento.
* `fechadoPor`: usuario que fechou.
* `justificativaId`: atestado vinculado.
* `auditPayloads`: logs coletados para gravacao posterior.

## Funcoes e Metodos

* `ehHoje(dataAula)`: compara data em UTC.
* `validarDataHoje(dataAula,bypass)`: atualmente relaxado.
* `verificarDiarioAberto(turmaId,dataAula,role)`: bloqueia se fechado e nao admin.
* `create(dto,auditUser)`: cria chamada individual.
* `salvarLote(dto,auditUser)`: grava lote atomico.
* `findAll(query)`: lista registros.
* `findResumo(query)`: lista agrupamento por aula.
* `getRelatorioAluno(turmaId,alunoId)`: calcula presencas/faltas/taxa.
* `findOne(id)`: detalhe.
* `update(id,dto,auditUser)`: edita chamada.
* `remove(id,auditUser)`: remove chamada.
* `fecharDiario(turmaId,dataAula,auditUser)`: fecha diario.
* `reabrirDiario(turmaId,dataAula,auditUser)`: reabre diario para admin.

## Classes

* `FrequenciasController`
* `FrequenciasService`
* `CreateFrequenciaDto`
* `CreateFrequenciaLoteDto`
* `FrequenciaAlunoBadgeDto`
* `UpdateFrequenciaDto`
* `QueryFrequenciaDto`

## Interfaces e Tipagens

* `Role`
* `AuditAcao`
* `Prisma.FrequenciaWhereInput`
* `StatusFrequencia`

---

# 5. Servicos e Integracoes

## APIs

* `POST /api/frequencias`
* `POST /api/frequencias/lote`
* `GET /api/frequencias`
* `GET /api/frequencias/resumo`
* `GET /api/frequencias/relatorio/turma/:turmaId/aluno/:alunoId`
* `GET /api/frequencias/:id`
* `PATCH /api/frequencias/:id`
* `DELETE /api/frequencias/:id`
* `POST /api/frequencias/diario/fechar/:turmaId/:dataAula`
* `POST /api/frequencias/diario/reabrir/:turmaId/:dataAula`

## Banco de Dados

Entidade `Frequencia`, relacionada a `Aluno`, `Turma` e `Atestado`.

## Servicos Externos

Nao ha integracoes externas.

---

# 6. Seguranca e Qualidade

## Seguranca

* Diario fechado impede edicao por nao admin.
* Reabertura exige `ADMIN` no service e roles no controller.
* Delete restrito a `ADMIN` e `SECRETARIA`.
* Erros de transacao em lote nao vazam detalhes do banco.

## Qualidade

* Transacao em lote evita estado parcial.
* Preserva `FALTA_JUSTIFICADA`.
* Autojustificativa consulta atestado ativo.
* Resumo evita N+1 usando mapas em memoria.

## Performance

* Preload de frequencias existentes no lote.
* `groupBy` para resumos.
* Queries paralelas para presentes e diarios fechados.

---

# 7. Regras de Negocio

* Uma chamada por aluno/turma/data.
* Falta justificada por atestado nao deve ser sobrescrita por lote comum.
* Falta em data coberta por atestado vira justificada automaticamente.
* Professor so deveria operar dia atual conforme comentarios, mas regra esta relaxada em `validarDataHoje`.
* Diario fechado bloqueia alteracoes ate reabertura administrativa.

---

# 8. Pontos de Atencao

* `validarDataHoje` esta vazio; comentarios e endpoints descrevem regra que nao esta aplicada.
* Em alguns updates do lote apenas `presente` e alterado, sem sincronizar `status`, podendo manter divergencia legado/novo.
* `findResumo` faz paginacao em memoria apos `groupBy`, o que pode crescer com historico grande.

---

# 9. Relacao com Outros Modulos

* Depende de `Turmas` e `Beneficiaries`.
* Usa `Atestados` por relacao de justificativa.
* `Certificados` usa frequencia para validar elegibilidade.
* `AuditLog` rastreia criacao/atualizacao em lote.

---

# 10. Resumo Tecnico Final

Frequencias e modulo critico para integridade academica. A complexidade e alta por lote, justificativas, diario fechado e relatorios. O principal debito tecnico e alinhar definitivamente `presente` e `status`, alem de implementar ou remover a regra comentada de data atual.

