# 10 — Auth: Visão Geral do Módulo

---

# 1. Visão Geral

## Objetivo

Documentar a visão geral do módulo `src/auth/` da Braille API.

O módulo Auth centraliza login, refresh token, logout, perfil do usuário logado, troca de senha, atualização de foto e atualização de dados básicos de perfil.

## Responsabilidade

O módulo é responsável por autenticar usuários internos, emitir access token JWT, criar sessões persistentes em `UserSession`, rotacionar refresh tokens e revogar sessões quando necessário.

Principais responsabilidades:

- autenticar por `username` e senha;
- validar usuário ativo e não excluído;
- emitir JWT de acesso com expiração curta;
- criar refresh token opaco no formato `sessionId.secret`;
- armazenar apenas hash do refresh token;
- rotacionar refresh token a cada uso;
- preservar hash anterior para detectar reuso real;
- revogar sessão atual no logout;
- permitir troca de senha e atualização de perfil.

## Fluxo de Funcionamento

```txt
Login → valida usuário/senha → cria UserSession → gera JWT com sid → retorna tokens
Refresh → valida sessão/token → rotaciona refresh → retorna novos tokens
Logout → usa sid do JWT → revoga sessão atual
```

---

# 2. Arquitetura e Metodologias

## Padrões Arquiteturais Identificados

- NestJS Module Pattern;
- Controller-Service Pattern;
- DTO Pattern;
- JWT Authentication;
- Refresh Token Rotation;
- Session Table Pattern;
- RBAC Integration;
- Security by Design.

## Justificativa Técnica

A arquitetura usa access token curto e refresh token por sessão para equilibrar segurança e usabilidade.

O access token expira em 15 minutos. O refresh token dura 7 dias e é salvo no banco apenas como hash. A tabela `UserSession` permite múltiplas sessões por usuário, revogação seletiva e rastreamento por IP/user agent.

---

# 3. Fluxo Interno do Código

## Fluxo de Execução

### AuthModule

Registra `JwtModule` de forma assíncrona, obtendo `JWT_SECRET` via `ConfigService`. Também importa `UploadModule` porque o perfil pode trocar foto e remover a anterior via `UploadService`.

### AuthController

Expõe as rotas:

- `POST /auth/login`;
- `POST /auth/refresh`;
- `POST /auth/logout`;
- `GET /auth/me`;
- `PATCH /auth/trocar-senha`;
- `PATCH /auth/foto-perfil`;
- `PATCH /auth/perfil`.

### AuthService

Centraliza as regras de login, refresh, logout, troca de senha, perfil, criação de sessão, rotação de refresh token e revogação.

## Dependências Internas

| Dependência | Uso |
|---|---|
| `AuthController` | Rotas HTTP |
| `AuthService` | Regras de autenticação |
| `AuthGuard` | Proteção JWT |
| DTOs de Auth | Contratos de entrada |
| `PrismaService` | Acesso a `User` e `UserSession` |
| `UploadService` | Remoção de foto antiga |

## Dependências Externas

| Biblioteca | Uso |
|---|---|
| `@nestjs/jwt` | JWT |
| `@nestjs/config` | `JWT_SECRET` |
| `bcrypt` | Hash e comparação |
| `node:crypto` | Segredos e UUID |
| `@prisma/client` | `Role` e models |

---

# 4. Dicionário Técnico

## Variáveis

| Nome | Objetivo |
|---|---|
| `AUTH_SELECT` | Select mínimo para autenticação |
| `PERFIL_SELECT` | Select de perfil público |
| `REFRESH_TOKEN_TTL_DIAS` | Duração do refresh token |
| `dummyHash` | Mitigar timing attack |
| `sessionId` | Identificador da sessão |
| `refreshTokenHash` | Hash salvo em `UserSession` |
| `previousRefreshTokenHash` | Detectar reuso real |
| `revokedAt` | Indicar sessão revogada |

## Funções e Métodos

| Método | Objetivo |
|---|---|
| `login()` | Validar credenciais e emitir tokens |
| `refreshToken()` | Renovar tokens e rotacionar refresh |
| `logout()` | Revogar sessão |
| `trocarSenha()` | Alterar senha própria |
| `getMe()` | Retornar perfil logado |
| `atualizarFotoPerfil()` | Atualizar foto |
| `atualizarPerfil()` | Atualizar nome/e-mail |

---

# 5. Serviços e Integrações

## APIs

| Método | Rota | Proteção |
|---|---|---|
| `POST` | `/auth/login` | Pública |
| `POST` | `/auth/refresh` | Refresh token |
| `POST` | `/auth/logout` | JWT |
| `GET` | `/auth/me` | JWT |
| `PATCH` | `/auth/trocar-senha` | JWT |
| `PATCH` | `/auth/foto-perfil` | JWT |
| `PATCH` | `/auth/perfil` | JWT |

## Banco de Dados

Models principais:

- `User`;
- `UserSession`.

## Serviços Externos

- JWT;
- bcrypt;
- Cloudinary indiretamente via `UploadService`.

---

# 6. Segurança e Qualidade

## Segurança

- JWT curto;
- refresh token opaco;
- hash no banco;
- rotação a cada refresh;
- detecção de reuso real;
- bcrypt;
- `dummyHash` contra timing attack;
- mensagens genéricas;
- select mínimo;
- logout por `sid`.

## Qualidade

- controller fino;
- service concentra regra;
- DTOs isolam contratos;
- métodos privados segmentam responsabilidades.

## Performance

- bcrypt tem custo intencional;
- select mínimo reduz tráfego;
- busca de sessão por ID é eficiente.

---

# 7. Regras de Negócio

- usuário só autentica se estiver ativo e não excluído;
- access token expira em 15 minutos;
- refresh token expira em 7 dias;
- cada login cria uma nova sessão;
- cada refresh válido rotaciona o token;
- refresh expirado revoga sessão;
- reuso do token anterior revoga sessão;
- token aleatório inválido retorna 401 sem revogar sessão;
- logout revoga a sessão atual;
- troca de senha exige senha atual.

---

# 8. Pontos de Atenção

- `req.ip` depende da configuração de proxy;
- campos legados de refresh token ainda existem em `User`;
- refresh token precisa ser armazenado com segurança no frontend;
- bcrypt em refresh consome CPU sob alta carga.

---

# 9. Relação com Outros Módulos

| Módulo | Relação |
|---|---|
| `UsersModule` | Gerencia usuários que fazem login |
| `PrismaModule` | Fornece `User` e `UserSession` |
| `UploadModule` | Remove foto antiga |
| `AuthGuard` | Valida JWT |
| `RolesGuard` | Usa `role` do JWT |

---

# 10. Resumo Técnico Final

O módulo Auth é crítico para identidade e sessão. A implementação usa JWT curto, refresh token opaco, rotação por sessão, hash no banco, proteção contra timing attack e revogação seletiva.

Criticidade: muito alta.

Complexidade: alta.

Próximos documentos: `11-auth-controller.md`, `12-auth-service.md`, `13-auth-refresh-token-sessoes.md`, `14-auth-guards.md` e `15-auth-dtos-interfaces.md`.
