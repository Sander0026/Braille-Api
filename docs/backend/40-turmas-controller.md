# 40 — TurmasController (`src/turmas/turmas.controller.ts`)

---

# 1. Visão Geral

O `TurmasController` expõe as rotas HTTP do módulo de turmas/oficinas da Braille API.

Ele é responsável por:

- declarar endpoints `/turmas`;
- aplicar autenticação JWT;
- aplicar autorização por perfil;
- receber DTOs de criação, atualização, filtros e mudança de status;
- aplicar cache em consultas de leitura;
- extrair usuário de auditoria com `getAuditUser(req)`;
- delegar regras ao `TurmasService`;
- desativar auditoria automática com `@SkipAudit()`.

---

# 2. Proteção e Permissões

Decorators principais:

```txt
@ApiTags('Turmas e Oficinas')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@SkipAudit()
@Controller('turmas')
```

Leitura:

```txt
ADMIN
SECRETARIA
PROFESSOR
```

Mutações:

```txt
ADMIN
SECRETARIA
```

---

# 3. Rotas

| Método | Rota | Perfil | Service | Responsabilidade |
|---|---|---|---|---|
| `POST` | `/turmas` | ADMIN/SECRETARIA | `create()` | Criar turma |
| `GET` | `/turmas` | ADMIN/SECRETARIA/PROFESSOR | `findAll()` | Listar turmas |
| `GET` | `/turmas/professores-ativos` | ADMIN/SECRETARIA/PROFESSOR | `findProfessoresAtivos()` | Listar professores com turmas |
| `GET` | `/turmas/:id/alunos-disponiveis` | ADMIN/SECRETARIA | `findAlunosDisponiveis()` | Listar alunos sem conflito |
| `GET` | `/turmas/:id` | ADMIN/SECRETARIA/PROFESSOR | `findOne()` | Detalhar turma |
| `PATCH` | `/turmas/:id` | ADMIN/SECRETARIA | `update()` | Atualizar turma |
| `PATCH` | `/turmas/:id/status` | ADMIN/SECRETARIA | `mudarStatus()` | Mudar status acadêmico |
| `DELETE` | `/turmas/:id` | ADMIN/SECRETARIA | `arquivar()` | Arquivar turma |
| `PATCH` | `/turmas/:id/restaurar` | ADMIN/SECRETARIA | `restaurar()` | Restaurar turma |
| `PATCH` | `/turmas/:id/ocultar` | ADMIN/SECRETARIA | `ocultar()` | Ocultar turma |
| `POST` | `/turmas/:id/alunos/:alunoId` | ADMIN/SECRETARIA | `addAluno()` | Matricular aluno |
| `DELETE` | `/turmas/:id/alunos/:alunoId` | ADMIN/SECRETARIA | `removeAluno()` | Desmatricular aluno |
| `PATCH` | `/turmas/:id/cancelar` | ADMIN/SECRETARIA | `cancelar()` | Cancelar turma |
| `PATCH` | `/turmas/:id/concluir` | ADMIN/SECRETARIA | `concluir()` | Concluir turma |

---

# 4. Cache

Rotas com cache:

- `GET /turmas`;
- `GET /turmas/professores-ativos`;
- `GET /turmas/:id`.

Usam:

```txt
CacheInterceptor
CacheTTL(30000)
```

Ponto de atenção: após mutações, respostas cacheadas podem ficar defasadas por alguns segundos.

---

# 5. Auditoria

O controller usa `@SkipAudit()` na classe inteira.

Por isso, mutações enviam `getAuditUser(req)` para o service, que registra auditoria manual.

---

# 6. Pontos de Atenção

- Novas mutações precisam registrar auditoria manual no service.
- O controller mistura roles como string e enum `Role`.
- Cache precisa de estratégia futura de invalidação explícita.
- Transições de status são validadas no service.

---

# 7. Resumo Técnico Final

O `TurmasController` é uma camada HTTP fina e segura para o domínio acadêmico de turmas.

Criticidade: muito alta.

Complexidade: média/alta.

Próximos passos recomendados: padronizar roles com enum, criar testes e2e de RBAC e implementar invalidação explícita de cache após mutações.
