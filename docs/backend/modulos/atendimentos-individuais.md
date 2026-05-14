# Atendimentos Individuais

Modulo para registrar acompanhamentos e atendimentos individuais entre professor e aluno, independente de turmas.

## Objetivo

O aluno continua sendo o cadastro central. O acompanhamento individual representa o vinculo continuo entre aluno, professor e assunto principal. O atendimento individual representa cada encontro, falta, cancelamento ou observacao.

## O que foi implementado

Foi criada a base backend do modulo `atendimentos-individuais`, com:

- modelagem propria no Prisma;
- migration dedicada;
- modulo NestJS isolado;
- controllers separados por responsabilidade;
- DTOs com validacao;
- policy central para permissoes por perfil e por recurso;
- service de dominio para acompanhamento, atendimentos, anexos e relatorio consolidado;
- upload seguro para arquivos de atendimento;
- documentacao Swagger nos endpoints;
- documentacao tecnica em `docs/backend`.

## Por que foi feito assim

O atendimento individual nao foi implementado como turma com um aluno porque a regra de negocio e diferente. Turmas representam cursos coletivos, chamadas e certificados. O atendimento individual representa um acompanhamento continuo, pedagogico ou administrativo, que pode ter presencas, faltas, anexos, alteracao de assunto e finalizacao propria.

Por isso o modulo foi separado em quatro conceitos:

- `AcompanhamentoIndividual`: vinculo principal entre aluno, professor e assunto.
- `AtendimentoIndividual`: cada registro dentro do acompanhamento.
- `ArquivoAtendimentoIndividual`: anexos de registros, como atestados, laudos e materiais.
- `HistoricoAssuntoAcompanhamento`: trilha de auditoria quando o assunto principal muda.

Essa separacao evita acoplar a funcionalidade ao modulo de turmas e permite evoluir futuramente para relatorios, indicadores, anexos sensiveis e auditoria sem quebrar o fluxo academico existente.

## Banco de Dados

Modelos adicionados:

- `AcompanhamentoIndividual`
- `AtendimentoIndividual`
- `ArquivoAtendimentoIndividual`
- `HistoricoAssuntoAcompanhamento`

Enums adicionados:

- `StatusAcompanhamentoIndividual`: `EM_ANDAMENTO`, `FINALIZADO`, `ARQUIVADO`
- `TipoRegistroAtendimentoIndividual`: `ATENDIMENTO_REALIZADO`, `FALTA_JUSTIFICADA`, `FALTA_NAO_JUSTIFICADA`, `CANCELADO`
- `CategoriaArquivoAtendimentoIndividual`: `ATESTADO`, `LAUDO`, `MATERIAL_PEDAGOGICO`, `DOCUMENTO`, `OUTRO`

Migration:

- `20260508110000_create_atendimentos_individuais`

Relacoes adicionadas:

- `Aluno 1:N AcompanhamentoIndividual`
- `Aluno 1:N AtendimentoIndividual`
- `User 1:N AcompanhamentoIndividual` como professor responsavel
- `User 1:N AtendimentoIndividual` como professor do registro
- `AcompanhamentoIndividual 1:N AtendimentoIndividual`
- `AtendimentoIndividual 1:N ArquivoAtendimentoIndividual`
- `AcompanhamentoIndividual 1:N HistoricoAssuntoAcompanhamento`

## Permissoes

Perfis com acesso:

- `ADMIN`
- `SECRETARIA`
- `PROFESSOR`

Regras:

- Professor cria, visualiza e altera apenas acompanhamentos vinculados a ele.
- Admin e secretaria podem listar por aluno, professor, status e periodo.
- Atendimento nao pode ser registrado em acompanhamento finalizado ou arquivado.
- Alteracao de assunto gera historico em `HistoricoAssuntoAcompanhamento`.
- Reabertura e finalizacao respeitam o escopo de acesso do usuario autenticado.
- Arquivos de atendimento so podem ser anexados quando o usuario tem acesso ao atendimento.

## Fluxos entregues

### Criar acompanhamento

1. O usuario informa aluno, assunto principal e descricao opcional.
2. Se o usuario for professor, o backend usa o proprio usuario como professor responsavel.
3. Se o usuario for admin ou secretaria, `professorId` deve ser informado.
4. O backend valida se aluno e professor existem.
5. O acompanhamento e criado com status `EM_ANDAMENTO`.

### Criar atendimento

1. O usuario informa o tipo de registro e os campos pedagogicos.
2. O backend valida as regras do tipo:
   - atendimento realizado exige assunto do dia e observacao;
   - falta justificada exige observacao;
   - falta nao justificada e cancelado permitem observacao opcional.
3. O backend bloqueia novos registros em acompanhamento finalizado ou arquivado.
4. O atendimento e vinculado ao acompanhamento, aluno e professor.

### Alterar assunto

1. O usuario informa novo assunto e motivo.
2. O backend registra o valor anterior e o novo valor.
3. A alteracao fica salva em `HistoricoAssuntoAcompanhamento`.

### Finalizar acompanhamento

1. O usuario informa resultado e resumo final.
2. O status muda para `FINALIZADO`.
3. A data de finalizacao e registrada.
4. Novos atendimentos passam a ser bloqueados.

### Relatorio consolidado

1. O usuario filtra por aluno, professor, periodo, status ou tipo de registro.
2. O backend retorna acompanhamentos, registros cronologicos e totais.
3. Os totais separam atendimentos realizados, faltas justificadas, faltas nao justificadas e cancelamentos.

## Endpoints

### Acompanhamentos

`POST /atendimentos-individuais/acompanhamentos`

Cria acompanhamento individual. Para professor, `professorId` pode ser omitido e o backend usa o usuario autenticado. Para admin/secretaria, `professorId` e obrigatorio.

`GET /atendimentos-individuais/acompanhamentos`

Lista acompanhamentos com filtros:

- `page`
- `limit`
- `alunoId`
- `professorId`
- `status`
- `busca`
- `dataInicio`
- `dataFim`

`GET /atendimentos-individuais/acompanhamentos/:id`

Busca acompanhamento com aluno, professor, atendimentos, arquivos e historico de assunto.

`PATCH /atendimentos-individuais/acompanhamentos/:id/assunto`

Atualiza o assunto e registra historico.

`PATCH /atendimentos-individuais/acompanhamentos/:id/finalizar`

Finaliza acompanhamento.

`PATCH /atendimentos-individuais/acompanhamentos/:id/reabrir`

Reabre acompanhamento.

### Atendimentos

`POST /atendimentos-individuais/acompanhamentos/:id/atendimentos`

Cria registro no acompanhamento.

Regras por tipo:

- `ATENDIMENTO_REALIZADO`: exige `assuntoDoDia` e `observacao`.
- `FALTA_JUSTIFICADA`: exige `observacao`.
- `FALTA_NAO_JUSTIFICADA`: observacao opcional.
- `CANCELADO`: observacao opcional.

`GET /atendimentos-individuais/acompanhamentos/:id/atendimentos`

Lista registros de um acompanhamento.

`GET /atendimentos-individuais/atendimentos/:id`

Busca atendimento por ID.

`POST /atendimentos-individuais/atendimentos/:id/arquivos`

Anexa arquivo ao atendimento.

Tipos aceitos:

- PDF
- PNG
- JPG/JPEG
- DOCX

Limite:

- 10 MB

Upload:

- Usa Cloudinary via `UploadService.uploadArquivoAtendimento`.
- Pasta: `braille_atendimentos`.

### Relatorios

`GET /atendimentos-individuais/relatorios`

Retorna relatorio consolidado com:

- acompanhamentos filtrados;
- atendimentos cronologicos;
- totais de atendimentos realizados;
- faltas justificadas;
- faltas nao justificadas;
- cancelamentos.

## Swagger

Os controllers foram anotados com:

- `@ApiTags`
- `@ApiBearerAuth`
- `@ApiOperation`
- `@ApiParam`
- `@ApiBody`
- `@ApiConsumes`
- `@ApiResponse`

Grupos no Swagger:

- `Atendimentos Individuais - Acompanhamentos`
- `Atendimentos Individuais - Registros`
- `Atendimentos Individuais - Relatorios`

As rotas documentam:

- descricao do caso de uso;
- parametros de rota;
- query params principais;
- corpo esperado nos `POST` e `PATCH`;
- consumo multipart no upload de arquivos;
- respostas de sucesso;
- erros comuns como `400`, `401`, `403`, `404` e `409`.

## Arquivos principais

- `src/atendimentos-individuais/atendimentos-individuais.module.ts`
- `src/atendimentos-individuais/controllers/acompanhamentos-individuais.controller.ts`
- `src/atendimentos-individuais/controllers/atendimentos-individuais.controller.ts`
- `src/atendimentos-individuais/controllers/relatorios-atendimentos-individuais.controller.ts`
- `src/atendimentos-individuais/services/atendimentos-individuais.service.ts`
- `src/atendimentos-individuais/policies/atendimentos-individuais.policy.ts`
- `src/atendimentos-individuais/dto/*.dto.ts`
- `src/upload/upload.service.ts`
- `prisma/schema.prisma`

## Decisoes tecnicas

- A regra de permissao foi centralizada em uma policy para evitar duplicacao nos controllers.
- A listagem usa filtros e paginacao para evitar respostas grandes.
- O relatorio inicial retorna dados estruturados para o frontend montar tela e impressao.
- O upload usa o servico existente de arquivos para manter padrao com o restante do sistema.
- A exclusao fisica nao foi criada no MVP para preservar historico pedagogico.
- O modulo foi registrado no `AppModule` para ficar disponivel junto ao restante da API.

## Validacoes ja cobertas

- DTOs validam campos obrigatorios, tamanho de texto, datas e enums.
- Acompanhamento finalizado ou arquivado nao aceita novo atendimento.
- Professor nao acessa acompanhamento de outro professor.
- Admin e secretaria podem consultar de forma ampla.
- Upload limita formato e tamanho.
- Alteracao de assunto exige motivo.

## Pontos futuros

- Relatorio PDF gerado pelo backend.
- Exclusao logica de atendimentos via endpoint dedicado.
- Edicao controlada de atendimentos com historico.
- Download protegido de anexos.
- Testes unitarios e e2e do modulo.
- Indicadores administrativos por professor, aluno e periodo.
