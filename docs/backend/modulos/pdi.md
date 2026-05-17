# Modulo: PDI / Plano Individual do Aluno

---

# 1. Visao Geral

O PDI registra o acompanhamento pedagogico/social individual do aluno.

Ele responde:

- qual objetivo foi combinado para o aluno;
- quais dificuldades e necessidades de acessibilidade foram identificadas;
- quais metas foram definidas;
- quais evolucoes foram registradas;
- o que a instituicao fez para apoiar o aluno.

O historico deve ser preservado. Por isso, `DELETE /pdi/:id` arquiva o PDI em vez de remover o
registro fisicamente.

---

# 2. Onde Fica Cada Coisa

| Area | Arquivo | Papel |
|---|---|---|
| Schema | `prisma/schema.prisma` | Enums `StatusPdi`, `AreaPdi`, `StatusMetaPdi` e modelos `PdiAluno`, `PdiMeta`, `PdiEvolucao` |
| Migration | `prisma/migrations/20260517203000_create_pdi_aluno/` | Cria tabelas, enums, indices e FKs |
| Modulo Nest | `src/pdi/pdi.module.ts` | Registra controller e service |
| Controller | `src/pdi/pdi.controller.ts` | Rotas HTTP e roles |
| Service | `src/pdi/pdi.service.ts` | Regras de negocio, escopo por professor e auditoria |
| DTOs | `src/pdi/dto/` | Contratos de criacao, atualizacao, metas, evolucoes e query |
| Testes | `src/pdi/pdi.service.spec.ts` | Regras criticas |

---

# 3. Endpoints

Base: `/api/pdi`

| Metodo | Rota | Uso |
|---|---|---|
| `GET` | `/` | Lista PDIs com filtros e paginacao |
| `POST` | `/` | Cria PDI |
| `GET` | `/:id` | Detalha PDI com metas e evolucoes |
| `PATCH` | `/:id` | Atualiza dados, status e datas |
| `DELETE` | `/:id` | Arquiva PDI |
| `POST` | `/:id/metas` | Adiciona meta |
| `PATCH` | `/:id/metas/:metaId` | Atualiza meta/status |
| `DELETE` | `/:id/metas/:metaId` | Remove meta |
| `POST` | `/:id/evolucoes` | Registra evolucao |
| `GET` | `/:id/evolucoes` | Lista evolucoes |
| `DELETE` | `/:id/evolucoes/:evolucaoId` | Remove evolucao |
| `GET` | `/aluno/:alunoId` | Lista historico de PDIs do aluno |
| `GET` | `/aluno/:alunoId/ativo` | Retorna PDI ativo do aluno |

As rotas `/aluno/:alunoId` ficam antes de `/:id` no controller para evitar conflito com rota
dinamica.

---

# 4. Regras de Negocio

- Um aluno pode ter varios PDIs no historico.
- Apenas um PDI `ATIVO` por aluno e permitido.
- Criar um novo PDI com outro ativo retorna erro orientando concluir ou arquivar o anterior.
- Concluir PDI exige `dataConclusao`.
- PDI `CONCLUIDO` ou `ARQUIVADO` nao aceita novas metas/evolucoes.
- Meta `ALCANCADA` passa pelo endpoint de atualizacao e gera auditoria.
- Professor enxerga/edita somente PDI sob sua responsabilidade ou de alunos em suas turmas.
- `ADMIN` e `SECRETARIA` enxergam/editam tudo.
- Toda criacao, atualizacao, arquivamento e exclusao de subregistro registra `AuditLog`.

---

# 5. Escopo de Professor

O service aplica filtro por professor com:

```ts
{
  OR: [
    { professorResponsavelId: professorId },
    {
      aluno: {
        matriculasOficina: {
          some: {
            turma: {
              OR: [{ professorId }, { professorAuxiliarId: professorId }],
            },
          },
        },
      },
    },
  ],
}
```

Assim o professor pode acompanhar alunos que atende mesmo quando ele nao foi definido como
responsavel direto pelo PDI.

---

# 6. Testes

```bash
npm test -- pdi.service.spec.ts --runInBand
```

Cenarios cobertos:

- bloqueio de PDI ativo duplicado;
- data obrigatoria ao concluir;
- criacao com auditoria;
- filtro de professor aplicado na listagem.

---

# 7. Pontos de Atencao

- Nao transformar arquivamento em delete fisico sem discutir retencao de historico.
- Se a instituicao quiser substituir PDI ativo automaticamente, criar uma regra explicita no DTO.
- A integracao com atendimentos individuais ainda e futura; hoje evolucoes sao registradas no PDI.
- Relatorios agregados de PDI ainda podem ser adicionados na proxima fase.
