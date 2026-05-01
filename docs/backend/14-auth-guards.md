# 14 — Auth Guards (`AuthGuard`, `RolesGuard` e `@Roles`)

---

# 1. Visão Geral

## Objetivo

Documentar os mecanismos de autenticação e autorização baseados em guards no módulo `src/auth/`.

Arquivos documentados:

```txt
src/auth/auth.guard.ts
src/auth/roles.guard.ts
src/auth/roles.decorator.ts
```

## Responsabilidade

Os guards são responsáveis por proteger rotas sensíveis da API.

- `AuthGuard`: valida JWT Bearer, verifica usuário no banco e popula `req.user`.
- `RolesGuard`: valida se o perfil do usuário possui permissão para acessar a rota.
- `@Roles`: registra metadados de perfis permitidos em controllers ou métodos.

## Fluxo de Funcionamento

```txt
Requisição HTTP protegida
  ↓
AuthGuard
  ↓
Extrai Bearer token
  ↓
Valida JWT com JwtService
  ↓
Consulta User no banco
  ↓
Bloqueia se usuário não existir, estiver inativo ou excluído
  ↓
Preenche request.user
  ↓
RolesGuard
  ↓
Lê metadados do @Roles()
  ↓
Compara user.role com roles permitidas
  ↓
Permite ou bloqueia acesso
```

---

# 2. Arquitetura e Metodologias

## Padrões Arquiteturais Identificados

- Guard Pattern;
- RBAC — Role-Based Access Control;
- Metadata Reflection Pattern;
- JWT Bearer Authentication;
- Request Enrichment Pattern;
- Defense in Depth;
- Real-time User Status Validation.

## Justificativa Técnica

Separar autenticação e autorização em guards permite proteger rotas de forma declarativa e reutilizável.

O `AuthGuard` responde à pergunta:

```txt
O usuário está autenticado e ainda é válido no sistema?
```

O `RolesGuard` responde à pergunta:

```txt
O usuário autenticado possui perfil suficiente para acessar esta rota?
```

Essa separação melhora manutenção, reduz duplicidade e permite que controllers combinem `@UseGuards(AuthGuard, RolesGuard)` com `@Roles(...)` conforme a criticidade da rota.

---

# 3. Fluxo Interno do Código

## AuthGuard

### Responsabilidade

O `AuthGuard` implementa `CanActivate`.

Ele:

- recebe o `ExecutionContext`;
- extrai o request HTTP;
- obtém o token Bearer do header `Authorization`;
- valida o token com `JwtService.verifyAsync()`;
- consulta o usuário no banco via `PrismaService`;
- bloqueia usuário inexistente, inativo ou excluído;
- popula `request.user` com o payload JWT.

### Extração do Token

O método privado `extractTokenFromHeader()` lê:

```txt
Authorization: Bearer <token>
```

Se o header não existir ou não começar com `Bearer`, retorna `undefined`.

### Validação do JWT

O guard chama:

```txt
jwtService.verifyAsync(token)
```

A validação usa o segredo configurado no `JwtModule`. O código evita passar `process.env.JWT_SECRET` diretamente, reduzindo risco de configuração insegura.

### Verificação em Tempo Real do Usuário

Após validar o JWT, o guard consulta `User` por `payload.sub`.

Campos consultados:

- `id`;
- `statusAtivo`;
- `excluido`.

Essa consulta garante revogação prática antes do JWT expirar. Se o administrador desativar ou excluir um usuário, o próximo acesso protegido já será bloqueado.

## RolesGuard

### Responsabilidade

O `RolesGuard` também implementa `CanActivate`.

Ele usa `Reflector` para ler os perfis exigidos pelo decorator `@Roles()`.

Fluxo:

1. lê metadados em método e classe;
2. se não houver `@Roles`, permite acesso para qualquer usuário autenticado;
3. lê `request.user` preenchido pelo `AuthGuard`;
4. verifica se `user.role` está na lista permitida;
5. lança `ForbiddenException` se não tiver permissão.

## Roles Decorator

O decorator define:

```txt
ROLES_KEY = 'roles'
```

E exporta:

```txt
Roles(...roles)
```

Ele usa `SetMetadata()` para gravar no handler ou classe quais roles são permitidas.

---

# 4. Dicionário Técnico

## Variáveis

| Nome | Objetivo |
|---|---|
| `request` | Requisição HTTP atual |
| `token` | JWT extraído do header Authorization |
| `payload` | Conteúdo validado do JWT |
| `userAtivo` | Consulta mínima do usuário no banco |
| `requiredRoles` | Roles exigidas pela rota/classe |
| `user` | Usuário autenticado presente em `request.user` |
| `ROLES_KEY` | Chave de metadata usada pelo decorator |

## Funções e Métodos

| Método/Função | Objetivo |
|---|---|
| `AuthGuard.canActivate()` | Validar autenticação JWT e status do usuário |
| `extractTokenFromHeader()` | Extrair token Bearer do header |
| `RolesGuard.canActivate()` | Validar autorização por perfil |
| `Roles(...roles)` | Registrar roles permitidas via metadata |

## Classes

| Classe | Responsabilidade |
|---|---|
| `AuthGuard` | Autenticar request via JWT |
| `RolesGuard` | Autorizar request por role |

## Interfaces e Tipagens

| Tipo | Uso |
|---|---|
| `CanActivate` | Contrato NestJS para guards |
| `ExecutionContext` | Acesso ao contexto HTTP |
| `AuthenticatedRequest` | Request tipado com `user` |

---

# 5. Serviços e Integrações

## APIs

Os guards não expõem endpoints diretamente. Eles protegem endpoints declarados em controllers.

Exemplos de uso:

```ts
@UseGuards(AuthGuard)
```

```ts
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN)
```

## Banco de Dados

O `AuthGuard` consulta o model `User` para validar se o usuário ainda está ativo e não excluído.

O `RolesGuard` não acessa banco; ele usa o payload já preenchido em `request.user`.

## Serviços Externos

- `JwtService` para validação JWT;
- `Reflector` para leitura de metadados;
- `PrismaService` para consulta do usuário.

---

# 6. Segurança e Qualidade

## Segurança

Pontos fortes:

- rejeita token ausente;
- rejeita token inválido ou expirado;
- não usa `process.env.JWT_SECRET` diretamente no guard;
- verifica usuário no banco a cada request protegido;
- bloqueia usuário inativo ou excluído imediatamente;
- separa autenticação de autorização;
- `RolesGuard` retorna 403 quando usuário autenticado não tem permissão.

## Qualidade

- guards pequenos e coesos;
- `AuthGuard` foca em identidade;
- `RolesGuard` foca em permissão;
- decorator `@Roles` é simples e reutilizável;
- uso de `Reflector.getAllAndOverride()` permite sobrescrever roles em método ou classe.

## Performance

O `AuthGuard` faz uma consulta ao banco em cada rota protegida. Isso melhora segurança, mas adiciona custo por requisição.

Trade-off:

- mais segurança e revogação imediata;
- maior carga no banco em endpoints protegidos.

---

# 7. Regras de Negócio

- rota protegida exige token Bearer válido;
- usuário inativo não acessa rotas protegidas;
- usuário excluído não acessa rotas protegidas;
- se rota não tiver `@Roles`, qualquer usuário autenticado pode acessar;
- se rota tiver `@Roles`, `user.role` precisa estar na lista permitida;
- falha de autenticação retorna 401;
- falha de autorização retorna 403.

---

# 8. Pontos de Atenção

- o `AuthGuard` consulta o banco a cada request protegido;
- se houver alta carga, pode ser necessário cache curto de status do usuário;
- o `RolesGuard` depende da ordem correta de guards, pois espera `request.user` preenchido;
- roles são strings no decorator, embora o projeto use enum `Role` em vários pontos;
- uma rota com `AuthGuard` mas sem `@Roles` fica acessível a qualquer perfil autenticado.

---

# 9. Relação com Outros Módulos

| Módulo | Relação |
|---|---|
| `AuthService` | Emite JWT validado pelo `AuthGuard` |
| `UsersModule` | Altera status/role que afetam guards |
| `PrismaService` | Consulta usuário no `AuthGuard` |
| Controllers | Aplicam `@UseGuards` e `@Roles` |
| `AuthenticatedRequest` | Recebe payload JWT em `request.user` |

---

# 10. Resumo Técnico Final

Os guards do módulo Auth implementam a barreira principal de segurança das rotas protegidas da API.

O `AuthGuard` valida identidade e status real do usuário. O `RolesGuard` valida autorização por perfil. O decorator `@Roles` permite configurar permissões de forma declarativa.

Criticidade: muito alta.

Complexidade: média.

A implementação está segura e profissional, com principal ponto de atenção no custo da consulta ao banco em todas as rotas protegidas e na necessidade de garantir ordem correta dos guards.
