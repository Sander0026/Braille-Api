# Modulo: Atestados e Laudos

---

# 1. Visao Geral

## Objetivo

Documentar `src/atestados` e `src/laudos`, dominios de documentos medicos vinculados a alunos.

## Responsabilidade

Atestados justificam faltas em periodo especifico e laudos mantem historico medico digitalizado do aluno. Ambos controlam metadados, arquivos externos e auditoria.

## Fluxo de Funcionamento

Atestados criam um registro por periodo e, em transacao, atualizam frequencias `FALTA` para `FALTA_JUSTIFICADA`. Laudos criam, listam, atualizam e removem documentos medicos, apagando arquivo antigo do Cloudinary quando substituido/removido.

---

# 2. Arquitetura e Metodologias

## Padroes Arquiteturais Identificados

* Service Layer.
* Transaction Script em atestados.
* DTO Pattern.
* Audit Trail.
* Soft fail em limpeza de arquivos.
* Guard/Role-based Access Control.

## Justificativa Tecnica

Documentos medicos possuem alto impacto em frequencia e privacidade. Atestado exige atomicidade entre documento e justificativas. Laudo exige historico multiplo, porque o schema permite varios laudos por aluno.

---

# 3. Fluxo Interno do Codigo

## Fluxo de Execucao

1. `AtestadosService.criar` valida existencia do aluno.
2. Converte `dataInicio` e `dataFim`.
3. Valida intervalo.
4. Abre transacao para criar `Atestado`.
5. Atualiza frequencias do aluno no periodo com `status=FALTA`.
6. Retorna quantidade de faltas justificadas.
7. Remocao de atestado reverte frequencias vinculadas para `FALTA` e exclui o atestado em transacao.
8. Preview consulta faltas no periodo sem escrita.
9. `LaudosService.criar` valida aluno e cria `LaudoMedico`.
10. Atualizacao de laudo remove arquivo antigo se URL mudou.
11. Remocao tenta remover arquivo e deleta registro.

## Dependencias Internas

* `PrismaService`
* `UploadService`
* `AuditLogService` em laudos
* `ApiResponse`
* `getAuditUser`

## Dependencias Externas

* `@prisma/client`
* `class-validator`

---

# 4. Dicionario Tecnico

## Variaveis

* `FREQUENCIA_SELECT`: campos de frequencia retornados com atestado.
* `dataInicio`, `dataFim`: periodo coberto por atestado.
* `motivo`: justificativa textual.
* `arquivoUrl`: URL de PDF/imagem do documento.
* `registradoPorId`: usuario que registrou documento.
* `dataEmissao`: data do laudo.
* `medicoResponsavel`: profissional do laudo.

## Funcoes e Metodos

* `AtestadosService.criar(alunoId,dto,auditUser)`: cria atestado e justifica faltas.
* `listarPorAluno(alunoId)`: lista atestados do aluno.
* `findOne(id)`: detalhe do atestado.
* `atualizar(id,dto)`: altera motivo/arquivo.
* `remover(id)`: remove e reverte justificativas.
* `previewJustificativas(alunoId,dataInicio,dataFim)`: simula faltas afetadas.
* `validarAluno(alunoId)`: guarda de existencia.
* `validarIntervaloData(inicio,fim)`: impede fim anterior ao inicio.
* `LaudosService.criar(alunoId,dto,auditUser)`: cria laudo.
* `listarPorAluno(alunoId)`: lista laudos.
* `atualizar(id,dto,auditUser)`: retifica metadados.
* `remover(id,auditUser)`: exclui laudo e arquivo.

## Classes

* `AtestadosController`, `AtestadosService`.
* `CreateAtestadoDto`, `UpdateAtestadoDto`.
* `LaudosController`, `LaudosService`.
* `CreateLaudoDto`, `UpdateLaudoDto`.

## Interfaces e Tipagens

* `StatusFrequencia`
* `Aluno`
* `AuditUser`
* Entidades `Atestado`, `Frequencia`, `LaudoMedico`.

---

# 5. Servicos e Integracoes

## APIs

* `POST /api/alunos/:alunoId/atestados`
* `GET /api/alunos/:alunoId/atestados`
* `GET /api/alunos/:alunoId/atestados/preview`
* `GET /api/atestados/:id`
* `PATCH /api/atestados/:id`
* `DELETE /api/atestados/:id`
* `POST /api/alunos/:alunoId/laudos`
* `GET /api/alunos/:alunoId/laudos`
* `PATCH /api/laudos/:id`
* `DELETE /api/laudos/:id`

## Banco de Dados

* `Atestado`: periodo, motivo, arquivo, usuario registrador e aluno.
* `Frequencia`: atualizada por `justificativaId`.
* `LaudoMedico`: historico por aluno.

## Servicos Externos

Cloudinary por `UploadService.deleteFile`.

---

# 6. Seguranca e Qualidade

## Seguranca

* Rotas exigem autenticacao.
* Remocao de atestado exige `ADMIN` ou `SECRETARIA`.
* Laudos sao restritos por roles.
* Erros de Cloudinary em limpeza nao expoem detalhes ao cliente.

## Qualidade

* Atestado usa transacao para manter documento e frequencias coerentes.
* Preview evita escrita antes da confirmacao.
* Laudos registram auditoria de criacao/atualizacao/exclusao.

## Performance

* `updateMany` justifica varias faltas em uma operacao.
* Select de frequencias vinculadas evita campos pesados.

---

# 7. Regras de Negocio

* Data final do atestado nao pode ser anterior ao inicio.
* Atestado justifica somente frequencias com status `FALTA`.
* Remover atestado reverte todas as frequencias vinculadas para `FALTA`.
* Datas do atestado nao sao alteradas em update, apenas motivo/arquivo.
* Laudo exige `arquivoUrl`.

---

# 8. Pontos de Atencao

* Atestados nao registram auditoria via `AuditLogService`, apesar de receberem `auditUser`.
* Atualizacao de atestado nao permite mudar periodo; isso e coerente, mas deve estar claro para usuarios.
* Remocao fisica de laudo pode apagar historico medico; regra juridica deve confirmar permissao.

---

# 9. Relacao com Outros Modulos

* Dependem de `Beneficiaries`.
* Atestados alteram `Frequencias`.
* Usam `Upload`.
* Laudos usam `AuditLog`.

---

# 10. Resumo Tecnico Final

Atestados e laudos sao dominios de criticidade alta por envolverem saude e frequencia academica. A complexidade e media: atestados impactam dados derivados, laudos impactam armazenamento e auditoria. O principal ponto de melhoria e auditar tambem operacoes de atestados.

