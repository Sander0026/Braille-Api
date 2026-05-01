# 46 — FrequenciasController (`src/frequencias/frequencias.controller.ts`)

---

# 1. Visão Geral

O `FrequenciasController` expõe as rotas HTTP responsáveis por registrar, consultar, editar, remover e controlar chamadas/frequências das turmas.

Responsabilidades principais:

- declarar endpoints `/frequencias`;
- aplicar autenticação JWT;
- aplicar autorização por perfil;
- receber DTOs de chamada individual, chamada em lote, atualização e consulta;
- extrair `AuditUser` com `getAuditUser(req)`;
- delegar regras ao `FrequenciasService`;
- desativar auditoria automática com `@SkipAudit()`.

---

# 2. Decorators de Classe

```txt
@ApiTags('Frequências (Chamadas)')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@SkipAudit()
@Controller('frequencias')
```

Impacto:

- agrupa rotas no Swagger;
- exige token Bearer;
- aplica `AuthGuard`;
- aplica `RolesGuard`;
- desativa auditoria automática;
- define rota base `/frequencias`.

---

# 3. Rotas

| Método | Rota | Perfil | Service | Responsabilidade |
|---|---|---|---|---|
| `POST` | `/frequencias` | ADMIN/SECRETARIA/PROFESSOR | `create()` | Registrar chamada individual |
| `POST` | `/frequencias/lote` | ADMIN/SECRETARIA/PROFESSOR | `salvarLote()` | Registrar/atualizar chamada em lote |
| `GET` | `/frequencias` | ADMIN/SECRETARIA/PROFESSOR | `findAll()` | Listar chamadas |
| `GET` | `/frequencias/resumo` | ADMIN/SECRETARIA/PROFESSOR | `findResumo()` | Resumo agrupado por aula |
| `GET` | `/frequencias/relatorio/turma/:turmaId/aluno/:alunoId` | ADMIN/SECRETARIA/PROFESSOR | `getRelatorioAluno()` | Relatório do aluno |
| `GET` | `/frequencias/:id` | ADMIN/SECRETARIA/PROFESSOR | `findOne()` | Ver chamada específica |
| `PATCH` | `/frequencias/:id` | ADMIN/SECRETARIA/PROFESSOR | `update()` | Editar chamada |
| `DELETE` | `/frequencias/:id` | ADMIN/SECRETARIA | `remove()` | Remover chamada |
| `POST` | `/frequencias/diario/fechar/:turmaId/:dataAula` | ADMIN/SECRETARIA/PROFESSOR | `fecharDiario()` | Fechar diário |
| `POST` | `/frequencias/diario/reabrir/:turmaId/:dataAula` | ADMIN/SECRETARIA | `reabrirDiario()` | Reabrir diário |

---

# 4. Permissões

Registro, consulta, edição e fechamento:

```txt
ADMIN
SECRETARIA
PROFESSOR
```

Remoção:

```txt
ADMIN
SECRETARIA
```

Reabertura de diário no controller:

```txt
ADMIN
SECRETARIA
```

Regra efetiva no service:

```txt
ADMIN
```

Esse desalinhamento precisa ser padronizado.

---

# 5. Auditoria

O controller usa `@SkipAudit()` na classe inteira.

Portanto, mutações precisam ser auditadas manualmente no service.

Ponto de atenção: a auditoria explícita está implementada principalmente no fluxo de lote. Criação, edição, remoção, fechamento e reabertura devem receber auditoria manual completa em evolução futura.

---

# 6. Segurança e Qualidade

## Segurança

- todas as rotas exigem JWT;
- rotas usam controle de role;
- professor não remove chamada;
- diário fechado é validado no service;
- reabertura efetiva é bloqueada para não-admin;
- controller delega regras sensíveis ao service.

## Qualidade

- controller fino;
- rotas separadas por operação;
- uso consistente de DTOs;
- Swagger documentado;
- extração centralizada de auditoria;
- endpoints específicos para diário.

---

# 7. Pontos de Atenção

- `@SkipAudit()` exige auditoria manual em todas as mutações.
- Reabertura de diário tem permissão diferente entre controller e service.
- Rotas de professor são amplas; o service garante regras temporais.
- Controller não usa cache, o que é adequado para frequência.

---

# 8. Melhorias Futuras

- Padronizar permissão de reabertura entre controller e service.
- Auditar explicitamente criação, edição, remoção, fechamento e reabertura.
- Criar DTO de params para `turmaId`, `alunoId` e `dataAula`.
- Adicionar documentação Swagger de respostas.
- Criar testes e2e por perfil.

---

# 9. Resumo Técnico Final

O `FrequenciasController` é a camada HTTP do domínio de chamadas.

Ele protege rotas, separa operações individuais/lote/relatório/diário e delega regras sensíveis ao service.

Criticidade: muito alta.

Complexidade: média/alta.
