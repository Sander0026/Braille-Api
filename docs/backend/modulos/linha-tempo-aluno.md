# Modulo: Linha do Tempo do Aluno

---

# 1. Visao Geral

A linha do tempo do aluno registra fatos institucionais relevantes em uma tabela propria:
`EventoLinhaTempoAluno`.

Desde maio de 2026, a timeline nao e mais montada dinamicamente a partir de varias tabelas no
momento da leitura. Os eventos passam a ser materializados quando os modulos executam suas acoes.
Para dados antigos, o backfill existe apenas como script manual e nao roda automaticamente em
consultas.

Objetivos:

- preservar historico confiavel e auditavel do aluno;
- reduzir custo e complexidade das consultas;
- centralizar permissao e mascaramento LGPD;
- permitir eventos manuais institucionais;
- manter o endpoint interno ja usado pelo frontend.

---

# 2. Banco de Dados

Model principal: `EventoLinhaTempoAluno`.

Campos mais importantes:

| Campo | Uso |
|---|---|
| `alunoId` | Aluno dono do evento |
| `turmaId` | Turma relacionada, quando existir |
| `usuarioId` | Usuario que causou ou registrou o evento |
| `tipo` | Classificacao funcional do evento |
| `origem` / `origemId` | Fonte de negocio que gerou o evento |
| `chaveEvento` | Chave unica usada no `upsert` para evitar duplicidade |
| `dataEvento` | Data real do fato, usada na ordenacao |
| `titulo` / `descricao` | Texto exibido na timeline |
| `turmaNomeSnapshot`, `professorNomeSnapshot`, `usuarioNomeSnapshot` | Snapshots para preservar leitura historica |
| `metadata` | Dados complementares sanitizados |
| `visibilidade` | `INTERNA`, `PROFESSOR` ou `RESTRITA` |
| `sensivel` | Marca eventos que exigem mascaramento |

Enums:

- `TipoEventoLinhaTempoAluno`
- `OrigemEventoLinhaTempo`
- `VisibilidadeEventoLinhaTempo`

Relacoes:

- `Aluno.eventosLinhaTempo`
- `Turma.eventosLinhaTempo`
- `User.eventosLinhaTempoRegistrados`

Migration:

`prisma/migrations/20260518110000_create_eventos_linha_tempo_aluno`

---

# 3. Arquivos

| Area | Arquivo |
|---|---|
| Modulo Nest | `src/aluno-linha-tempo/aluno-linha-tempo.module.ts` |
| Controller | `src/aluno-linha-tempo/aluno-linha-tempo.controller.ts` |
| Consulta e permissoes | `src/aluno-linha-tempo/aluno-linha-tempo.service.ts` |
| Registro persistido | `src/aluno-linha-tempo/evento-linha-tempo.service.ts` |
| Backfill service | `src/aluno-linha-tempo/linha-tempo-backfill.service.ts` |
| Query DTO | `src/aluno-linha-tempo/dto/query-linha-tempo-aluno.dto.ts` |
| Evento manual DTO | `src/aluno-linha-tempo/dto/create-evento-linha-tempo-manual.dto.ts` |
| Swagger DTOs | `src/aluno-linha-tempo/dto/linha-tempo-aluno-response.dto.ts` |
| Script CLI | `prisma/scripts/backfill-linha-tempo.ts` |

---

# 4. Endpoints

Base com prefixo global:

`/api/beneficiaries/:id/linha-tempo`

## GET `/beneficiaries/:id/linha-tempo`

Lista eventos persistidos e paginados.

Query params:

| Parametro | Uso |
|---|---|
| `dataInicio` | Filtra eventos a partir da data informada |
| `dataFim` | Filtra eventos ate a data informada |
| `tipo` | Um tipo ou lista separada por virgula. Ex.: `PDI_CRIADO,PDI_EVOLUCAO` |
| `turmaId` | Restringe eventos vinculados a uma turma |
| `page` | Pagina da timeline |
| `limit` | Itens por pagina, maximo 100 |

## GET `/beneficiaries/:id/linha-tempo/resumo`

Resumo para cards da tela dedicada:

```json
{
  "totalEventos": 84,
  "ultimaFrequencia": "2026-05-18T11:00:00.000Z",
  "ultimoAtendimento": "2026-05-12T13:30:00.000Z",
  "ultimoPdi": "2026-05-10T09:00:00.000Z",
  "ultimaAcaoRisco": "2026-05-16T17:00:00.000Z"
}
```

## GET `/beneficiaries/:id/linha-tempo/turmas`

Lista apenas as turmas em que o aluno ja teve matricula. O frontend usa esse endpoint para evitar
que o filtro avancado dependa de UUID digitado manualmente.

Resposta:

```json
[
  { "id": "uuid", "nome": "Braille Nivel 1" }
]
```

## POST `/beneficiaries/:id/linha-tempo/manual`

Cria uma observacao institucional manual.

Usos esperados:

- reuniao com familia;
- entrega de material;
- orientacao avulsa;
- contato com responsavel;
- encaminhamento externo.

Payload:

```json
{
  "tipo": "OBSERVACAO_MANUAL",
  "dataEvento": "2026-05-18",
  "titulo": "Reuniao com familia",
  "descricao": "Responsavel recebeu orientacoes da secretaria.",
  "turmaId": "uuid",
  "sensivel": false
}
```

## DELETE `/beneficiaries/:id/linha-tempo/:eventoId`

Remove apenas eventos manuais (`OBSERVACAO_MANUAL` + origem `MANUAL`). Eventos automaticos nao sao
apagados por esse endpoint; devem ser corrigidos no modulo de origem.

---

# 5. Registro Automatico

O `EventoLinhaTempoService.registrarEvento()` usa `upsert` por `chaveEvento`.

Modulos que registram eventos:

| Modulo | Eventos |
|---|---|
| `BeneficiariesService` | cadastro, atualizacao, inativacao, reativacao e encerramentos de matriculas causados pela inativacao |
| `TurmasService` | matricula e encerramento de matricula |
| `FrequenciasService` | presenca, falta, falta justificada |
| `AtendimentosIndividuaisService` | atendimento e falta em atendimento |
| `PdiService` | PDI criado, meta criada/atualizada, evolucao, conclusao |
| `RiscoEvasaoService` | acao criada, resolvida ou cancelada |
| `AtestadosService` | atestado e faltas justificadas por atestado |
| `LaudosService` | laudo criado/removido |
| `CertificadosService` | certificados emitidos |

Padrao de `chaveEvento`:

```text
ORIGEM:ID_DA_ORIGEM:ACAO
```

---

# 6. Backfill

Script:

```bash
npm run timeline:backfill
```

Backfill de um aluno especifico:

```bash
npm run timeline:backfill -- --alunoId=<uuid>
```

O script consulta dados historicos, grava eventos via `EventoLinhaTempoService` e usa `upsert` por
`chaveEvento`, portanto pode ser repetido sem duplicar eventos. Em bases grandes pode demorar e
imprime resultado ao final.

Importante: o backend nao dispara backfill ao abrir a tela ou consultar resumo da linha do tempo.
Em bancos de teste ou planos pequenos, deixe o script sem executar e a timeline exibira apenas
eventos novos gerados apos a implantacao.

---

# 7. Permissoes e LGPD

| Role | Regra |
|---|---|
| `ADMIN` | Ve tudo |
| `SECRETARIA` | Ve tudo |
| `PROFESSOR` | Ve apenas alunos vinculados a turmas, atendimentos, acompanhamentos ou PDI sob sua responsabilidade |
| `COMUNICACAO` | Nao acessa linha do tempo individual |

Eventos sensiveis:

- `LAUDO`;
- `ATESTADO`;
- observacoes clinicas;
- dados medicos;
- observacoes manuais marcadas com `sensivel: true`.

Para professor, eventos sensiveis podem aparecer como existencia institucional, mas sem conteudo
detalhado:

```json
{
  "tipo": "LAUDO",
  "titulo": "Laudo medico registrado.",
  "descricao": "Detalhes restritos a secretaria e administracao.",
  "metadata": {
    "sensivel": true,
    "restrito": true
  }
}
```

Nunca retornar URLs de laudos, dados clinicos, CID, medico responsavel ou descricao medica para
professor via timeline.

---

# 8. Swagger

O controller documenta:

- `LinhaTempoAlunoResponseDto`;
- `LinhaTempoAlunoResumoDto`;
- `LinhaTempoAlunoTurmaResumoDto`;
- `LinhaTempoAlunoItemDto`;
- `CreateEventoLinhaTempoManualDto`.

A documentacao fica disponivel no Swagger global da API.

---

# 9. Checklist de Evolucao

Ao adicionar novo evento:

1. Confirmar se o tipo ja existe em `TipoEventoLinhaTempoAluno`.
2. Registrar pelo modulo de origem usando `EventoLinhaTempoService`.
3. Definir `chaveEvento` deterministica.
4. Definir `visibilidade` e `sensivel`.
5. Atualizar `LinhaTempoBackfillService` para eventos antigos.
6. Revisar mascaramento LGPD se houver dados pessoais ou medicos.
7. Atualizar esta documentacao e, se necessario, o frontend.
