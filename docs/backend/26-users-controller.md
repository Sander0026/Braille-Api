# 26 — UsersController (`src/users/users.controller.ts`)

---

# 1. Visão Geral

## Objetivo

Documentar o `UsersController`, responsável por expor as rotas administrativas de usuários internos da Braille API.

## Responsabilidade

O controller atua como camada HTTP do módulo `Users`.

Responsabilidades principais:

- declarar endpoints `/users`;
- aplicar proteção JWT;
- restringir todas as rotas ao perfil `ADMIN`;
- receber DTOs de criação, atualização e consulta;
- extrair dados de auditoria via `getAuditUser(req)`;
- delegar regras ao `UsersService`;
- desativar auditoria automática com `@SkipAudit()` porque o service faz auditoria manual.

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- Controller-Service Pattern;
- Thin Controller Pattern;
- RBAC;
- DTO Pattern;
- Manual Audit Pattern;
- Swagger Documentation Pattern.

## Justificativa Técnica

O controller é fino e não contém regra de negócio pesada. Ele valida a camada HTTP, aplica guards e delega decisões ao service.

A restrição por `@Roles(Role.ADMIN)` na classe inteira garante que qualquer rota adicionada ao controller herde a proteção administrativa por padrão.

---

# 3. Fluxo Interno do Código

## Decorators de Classe

O controller usa:

```txt
@ApiTags('Usuários do Sistema (Staff)')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@SkipAudit()
@Controller('users')
```

Impacto:

- agrupa rotas no Swagger;
- exige token Bearer;
- valida autenticação;
- valida perfil ADMIN;
- desativa auditoria automática;
- define base `/users`.

## Rotas

| Método | Rota | DTO/Entrada | Service | Responsabilidade |
|---|---|---|---|---|
| `POST` | `/users` | `CreateUserDto` | `create()` | Criar funcionário |
| `GET` | `/users` | `QueryUserDto` | `findAll()` | Listar usuários |
| `GET` | `/users/resumo` | `QueryUserDto` | `findResumo()` | Listar dados mínimos |
| `GET` | `/users/check-cpf` | `cpf` query | `checkCpf()` | Verificar existência/status de CPF |
| `PATCH` | `/users/:id` | `UpdateUserDto` | `update()` | Atualizar usuário |
| `POST` | `/users/:id/reativar` | `id` | `reativar()` | Reativar usuário |
| `DELETE` | `/users/:id` | `id` | `remove()` | Inativar usuário |
| `PATCH` | `/users/:id/reset-password` | `id` | `resetPassword()` | Resetar senha |
| `PATCH` | `/users/:id/restore` | `id` | `restore()` | Restaurar status ativo |
| `DELETE` | `/users/:id/hard` | `id` | `removeHard()` | Soft delete profundo |

## Auditoria Manual

Rotas mutáveis passam `getAuditUser(req)` para o service.

Como o controller usa `@SkipAudit()`, o `UsersService` é responsável por registrar auditoria manualmente.

---

# 4. Dicionário Técnico

## Variáveis

| Nome | Tipo | Objetivo |
|---|---|---|
| `createUserDto` | `CreateUserDto` | Payload de criação |
| `updateUserDto` | `UpdateUserDto` | Payload de atualização |
| `query` | `QueryUserDto` | Filtros e paginação |
| `cpf` | string opcional | CPF consultado |
| `id` | string | ID do usuário alvo |
| `req` | `AuthenticatedRequest` | Request autenticado para auditoria |

## Métodos

| Método | Objetivo |
|---|---|
| `create()` | Criar funcionário |
| `findAll()` | Listar usuários |
| `findResumo()` | Listar usuários mínimos |
| `checkCpf()` | Validar CPF |
| `update()` | Atualizar usuário |
| `reativar()` | Reativar funcionário |
| `remove()` | Inativar usuário |
| `resetPassword()` | Resetar senha |
| `restore()` | Restaurar status ativo |
| `removeHard()` | Marcar usuário como excluído |

---

# 5. Serviços e Integrações

## APIs

Todas as APIs são administrativas e exigem `ADMIN`.

## Banco de Dados

O controller não acessa banco diretamente. Ele delega ao `UsersService`, que usa `PrismaService`.

## Auditoria

O controller extrai `AuditUser` com `getAuditUser(req)` e entrega ao service.

---

# 6. Segurança e Qualidade

## Segurança

Pontos fortes:

- proteção por JWT;
- autorização por `Role.ADMIN` na classe inteira;
- auditoria manual nas ações administrativas;
- `checkCpf()` valida ausência de CPF antes de consultar;
- controller não retorna nem manipula senha diretamente.

## Qualidade

- controller fino;
- rotas claras;
- Swagger em todas as operações principais;
- DTOs dedicados;
- uso consistente de `getAuditUser(req)`.

---

# 7. Regras de Negócio

- somente `ADMIN` pode acessar `/users`;
- criação, alteração, reset, restauração e remoção devem ser auditadas;
- `checkCpf` exige CPF informado;
- o controller não decide regra de reativação, senha ou duplicidade; isso fica no service.

---

# 8. Pontos de Atenção

- Como `@SkipAudit()` está na classe inteira, qualquer nova rota mutável precisa ter auditoria manual no service.
- Rotas de listagem também ficam restritas a `ADMIN`.
- O endpoint `/users/check-cpf` pode revelar existência de CPF para ADMIN; isso é aceitável no contexto administrativo, mas deve continuar protegido.
- A rota `DELETE /users/:id/hard` faz soft delete profundo, apesar do nome sugerir exclusão permanente.

---

# 9. Relação com Outros Módulos

| Módulo | Relação |
|---|---|
| `UsersService` | Executa regras de negócio |
| `AuthGuard` | Valida JWT |
| `RolesGuard` | Restringe ao ADMIN |
| `AuditLogService` | Recebe auditoria manual via service |
| `Common` | Fornece `AuthenticatedRequest`, `getAuditUser` e `SkipAudit` |

---

# 10. Resumo Técnico Final

O `UsersController` está bem estruturado, fino e seguro. Todas as rotas são administrativas e protegidas exclusivamente para `ADMIN`.

Criticidade: muito alta.

Complexidade: média.

Principal cuidado futuro: qualquer nova rota adicionada ao controller deve manter auditoria manual no service, pois a auditoria automática está desativada com `@SkipAudit()`.
