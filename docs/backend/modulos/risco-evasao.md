# Modulo: Risco de Evasao

---

# 1. Visao Geral

O modulo transforma o relatorio de risco de evasao em fluxo de acompanhamento.

O endpoint `GET /relatorios/risco-evasao` continua sendo responsavel por identificar alunos em
risco. Este modulo (`/risco-evasao/acoes`) guarda as intervencoes feitas pela secretaria ou
coordenacao para cada aluno/turma.

Exemplo de uso:

1. O relatorio aponta um aluno com `ALTO` risco por `3 faltas seguidas`.
2. A secretaria cria uma acao `CONTATO_TELEFONICO` com responsavel e prazo.
3. A acao aparece como aberta no item do relatorio.
4. Ao resolver, o usuario informa o resultado da intervencao.
5. O historico fica preservado e auditado.

---

# 2. Onde Fica Cada Coisa

| Area | Arquivo | Papel |
|---|---|---|
| Schema | `prisma/schema.prisma` | Enums e modelo `AcaoRiscoEvasao` |
| Migration | `prisma/migrations/20260517193000_create_acoes_risco_evasao/` | Cria enums, tabela, indices e FKs |
| Modulo Nest | `src/risco-evasao/risco-evasao.module.ts` | Registra controller e service |
| Rotas HTTP | `src/risco-evasao/risco-evasao.controller.ts` | Endpoints, roles e audit user |
| Regras de negocio | `src/risco-evasao/risco-evasao.service.ts` | Validacoes, duplicidade, status e auditoria |
| DTO criacao | `src/risco-evasao/dto/create-acao-risco-evasao.dto.ts` | Contrato do `POST` |
| DTO atualizacao | `src/risco-evasao/dto/update-acao-risco-evasao.dto.ts` | Contrato do `PATCH` |
| DTO query | `src/risco-evasao/dto/query-acoes-risco-evasao.dto.ts` | Filtros e paginacao da lista |
| Integracao com relatorio | `src/relatorios/relatorios.service.ts` | Inclui `acaoAberta` em `/relatorios/risco-evasao` |
| Testes | `src/risco-evasao/risco-evasao.service.spec.ts` | Regras criticas do modulo |

---

# 3. Modelo de Dados

Modelo principal: `AcaoRiscoEvasao`.

Relacionamentos:

- `alunoId` obrigatorio para `Aluno`;
- `turmaId` opcional para `Turma`;
- `responsavelId` opcional para `User`;
- `criadoPorId` guarda o usuario que criou a acao.

Enums:

- `NivelRiscoEvasao`: `ALTO`, `MEDIO`, `BAIXO`;
- `StatusAcaoRiscoEvasao`: `PENDENTE`, `EM_ANDAMENTO`, `RESOLVIDA`, `SEM_CONTATO`, `CANCELADA`;
- `TipoAcaoRiscoEvasao`: telefone, WhatsApp, reuniao, encaminhamento, ajuste de horario, transferencia, justificativa, visita ou outro.

Indices importantes:

- `alunoId`;
- `turmaId`;
- `responsavelId`;
- `status`;
- `nivel`;
- `prazo`.

Motivo: a tela precisa listar pendencias por aluno, turma, responsavel, status e prazo sem varrer a
tabela inteira.

---

# 4. Endpoints

Base: `/api/risco-evasao/acoes`

| Metodo | Rota | Uso |
|---|---|---|
| `GET` | `/` | Lista acoes com filtros e paginacao |
| `POST` | `/` | Cria acao de intervencao |
| `GET` | `/:id` | Detalha acao |
| `PATCH` | `/:id` | Atualiza responsavel, tipo, prazo, descricao, resultado ou status |
| `PATCH` | `/:id/status` | Atualiza status de forma direta |
| `DELETE` | `/:id` | Cancela a acao logicamente |

`DELETE` nao remove fisicamente. Ele marca a acao como `CANCELADA` e registra auditoria.

---

# 5. Permissoes

Classe do controller:

- `ADMIN`;
- `SECRETARIA`;
- `PROFESSOR`.

Operacoes de escrita:

- `ADMIN`;
- `SECRETARIA`.

Professor pode listar e detalhar, mas o service restringe ao escopo das proprias turmas:

```ts
{ turma: { professorId: user.sub } }
```

---

# 6. Regras de Negocio

## Duplicidade

Nao pode existir acao aberta duplicada para o mesmo:

- `alunoId`;
- `turmaId`;
- `motivoRisco`.

Statuses considerados abertos:

- `PENDENTE`;
- `EM_ANDAMENTO`;
- `SEM_CONTATO`.

## Resultado obrigatorio

Para marcar uma acao como `RESOLVIDA`, `resultado` e obrigatorio. Isso evita "fechar" uma
intervencao sem registrar o que aconteceu.

## Acao vencida

Uma acao e vencida quando:

- possui `prazo`;
- o prazo e menor que o inicio do dia atual;
- o status ainda esta aberto.

## Validacao de referencias

Ao criar/atualizar:

- aluno precisa existir e nao estar excluido;
- turma, se informada, precisa existir e nao estar excluida;
- responsavel, se informado, precisa estar ativo e nao excluido.

## Auditoria

O service registra auditoria manual em:

- criacao: `AuditAcao.CRIAR`;
- atualizacao/status: `AuditAcao.ATUALIZAR`;
- cancelamento: `AuditAcao.EXCLUIR`.

Entidade auditada: `AcaoRiscoEvasao`.

---

# 7. Integracao com Relatorios

`GET /relatorios/risco-evasao` agora inclui, em cada item, a acao aberta mais recente para o mesmo
aluno/turma:

```ts
acaoAberta?: {
  id: string;
  status: string;
  responsavel?: string;
  prazo?: string;
}
```

Tambem retorna indicadores:

- `acoesPendentes`;
- `acoesVencidas`;
- `acoesResolvidasNoMes`.

Essa integracao permite que o frontend mostre:

- `Criar acao`, quando nao ha acao aberta;
- `Ver acao` e `Resolver`, quando ja existe acompanhamento aberto.

---

# 8. Testes

Rodar:

```bash
npm test -- risco-evasao.service.spec.ts relatorios.service.spec.ts --runInBand
```

Cenarios essenciais:

- nao criar acao duplicada aberta;
- exigir resultado ao resolver;
- registrar auditoria;
- restringir professor as proprias turmas;
- relatorio de risco retornar `acaoAberta` e indicadores das acoes.

---

# 9. Pontos de Atencao

- Nao use este modulo para recalcular o risco. O calculo permanece em `RelatoriosService`.
- Nao remova a auditoria manual do service.
- Nao permita `RESOLVIDA` sem resultado.
- Se professor auxiliar tambem precisar ver acoes, ajustar o filtro de professor no service.
- Se futuramente houver muitas acoes, manter paginacao e filtros no banco.
