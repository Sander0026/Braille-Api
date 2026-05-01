# 25 — Users: Visão Geral do Módulo (`src/users/`)

---

# 1. Visão Geral

## Objetivo

Documentar a visão geral do módulo `Users`, responsável pela gestão administrativa dos usuários internos da Braille API.

Arquivos principais:

```txt
src/users/users.module.ts
src/users/users.controller.ts
src/users/users.service.ts
src/users/dto/create-user.dto.ts
src/users/dto/update-user.dto.ts
src/users/dto/query-user.dto.ts
```

## Responsabilidade

O módulo gerencia funcionários/staff do sistema.

Responsabilidades principais:

- criar usuários internos;
- gerar username automaticamente;
- gerar matrícula staff;
- aplicar senha padrão inicial;
- exigir troca de senha no primeiro login;
- listar usuários;
- listar resumo para seleções internas;
- validar CPF;
- atualizar dados cadastrais;
- inativar usuário;
- restaurar usuário;
- reativar usuário;
- resetar senha;
- aplicar soft delete profundo;
- auditar ações administrativas.

## Regra Central de Acesso

Todas as rotas do `UsersController` são restritas a:

```txt
ADMIN
```

A classe usa `AuthGuard`, `RolesGuard`, `@Roles(Role.ADMIN)` e `@SkipAudit()`.

Isso significa que `SECRETARIA`, `PROFESSOR` e `COMUNICACAO` não podem executar CRUD de usuários.

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- NestJS Module Pattern;
- Controller-Service Pattern;
- Service Layer;
- DTO Pattern;
- RBAC;
- Soft Delete;
- Manual Audit Pattern;
- Credential Bootstrap Pattern;
- Defensive Admin Operations.

## Justificativa Técnica

A gestão de usuários controla acesso ao sistema inteiro. Por isso, o módulo é restrito exclusivamente ao `ADMIN`.

O controller permanece fino e delega regras ao service. O service centraliza criação, atualização, auditoria, senha, reativação e proteção contra autoexclusão.

---

# 3. Fluxo Interno do Código

## UsersModule

Importa:

- `AuditLogModule`;
- `UploadModule`.

Declara:

- `UsersController`;
- `UsersService`.

## UsersController

Rotas sob `/users`:

| Método | Rota | Responsabilidade |
|---|---|---|
| `POST` | `/users` | Criar funcionário |
| `GET` | `/users` | Listar usuários |
| `GET` | `/users/resumo` | Listar dados mínimos |
| `GET` | `/users/check-cpf` | Verificar CPF |
| `PATCH` | `/users/:id` | Atualizar usuário |
| `POST` | `/users/:id/reativar` | Reativar usuário |
| `DELETE` | `/users/:id` | Inativar usuário |
| `PATCH` | `/users/:id/reset-password` | Resetar senha |
| `PATCH` | `/users/:id/restore` | Restaurar status ativo |
| `DELETE` | `/users/:id/hard` | Soft delete profundo |

## UsersService

Funções relevantes:

| Função | Responsabilidade |
|---|---|
| `resolverSenhaPadraoUsuario()` | Resolver senha padrão por ambiente |
| `gerarUsername()` | Gerar username único por nome |
| `montarFiltroListagem()` | Montar filtro para listagem |
| `create()` | Criar funcionário ou sinalizar reativação |
| `reativar()` | Reativar usuário e resetar senha |
| `checkCpf()` | Consultar existência/status por CPF |
| `findAll()` | Listar usuários paginados |
| `findResumo()` | Listar dados mínimos |
| `update()` | Atualizar dados e foto |
| `remove()` | Inativar usuário |
| `restore()` | Restaurar usuário inativo |
| `resetPassword()` | Resetar senha padrão |
| `removeHard()` | Marcar usuário como excluído |

---

# 4. Segurança e Qualidade

## Segurança

Pontos fortes:

- somente `ADMIN` acessa o módulo;
- senha padrão em produção deve vir de ambiente;
- senha é armazenada com bcrypt;
- usuário criado precisa trocar senha no primeiro login;
- admin não pode desativar/excluir a própria conta logada;
- admin não pode resetar de forma insegura a própria senha logada;
- CPF duplicado é bloqueado;
- senha não é retornada nas listagens;
- ações administrativas são auditadas.

## Qualidade

- controller fino;
- regras centralizadas no service;
- auditoria manual com contexto;
- geração automática de username e matrícula;
- paginação em listagem;
- listagem resumo separada para seleções internas.

---

# 5. Regras de Negócio

- apenas `ADMIN` gerencia usuários;
- username é gerado automaticamente a partir do nome;
- matrícula staff é gerada automaticamente;
- senha inicial é padrão e deve ser trocada no primeiro login;
- produção exige `SENHA_PADRAO_USUARIO` configurada;
- CPF ativo duplicado impede criação;
- CPF de usuário inativo/excluído retorna sinalização para reativação;
- inativação não exclui registro;
- soft delete profundo marca `excluido = true`;
- reativação restaura acesso e reseta senha;
- reset de senha marca `precisaTrocarSenha = true`;
- administrador não pode desativar/excluir a própria conta logada.

---

# 6. Pontos de Atenção

- criação/reativação retorna senha padrão em `_credenciais`; isso exige cuidado operacional;
- alteração de `SENHA_PADRAO_USUARIO` exige restart;
- reset de senha ainda não revoga automaticamente sessões existentes;
- `montarFiltroListagem()` pode ser tipado melhor;
- é recomendável criar testes e2e garantindo acesso apenas por `ADMIN`.

---

# 7. Relação com Outros Módulos

| Módulo | Relação |
|---|---|
| `AuthModule` | Usuários criados fazem login |
| `AuthGuard` | Protege rotas |
| `RolesGuard` | Garante acesso exclusivo ao ADMIN |
| `AuditLogModule` | Registra ações administrativas |
| `UploadModule` | Remove foto antiga |
| `PrismaModule` | Persiste usuários |
| `TurmasModule` | Pode relacionar professores a turmas |

---

# 8. Resumo Técnico Final

O módulo `Users` é crítico para a administração do sistema, pois controla os usuários internos e suas permissões.

A regra mais importante é que somente `ADMIN` pode executar operações nesse módulo.

Criticidade: muito alta.

Complexidade: alta.

A implementação é profissional, com geração automática de credenciais, auditoria manual, proteção contra autoexclusão e controle de status. Os principais próximos passos são revogar sessões após reset/reativação, criar testes e2e de RBAC e formalizar política de entrega de credenciais.
