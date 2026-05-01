# 11 — AuthController (`src/auth/auth.controller.ts`)

---

# 1. Visão Geral

## Objetivo

Documentar o `AuthController`, controller responsável por expor as rotas HTTP de autenticação da Braille API.

## Responsabilidade

O `AuthController` recebe requisições HTTP, aplica decorators, guards e DTOs, extrai o usuário autenticado quando necessário e delega toda regra de negócio para o `AuthService`.

Responsabilidades principais:

- declarar rotas do módulo Auth;
- receber payloads via DTOs;
- aplicar `AuthGuard` nas rotas protegidas;
- usar `@ApiBearerAuth()` nas rotas autenticadas;
- capturar IP e user agent no login;
- passar `sid` ao logout para revogar a sessão atual;
- centralizar extração de `userId` por `resolverUserId()`.

---

# 2. Arquitetura e Metodologias

## Padrões Arquiteturais Identificados

- Controller-Service Pattern;
- Thin Controller Pattern;
- DTO Pattern;
- Guard Pattern;
- Swagger Documentation Pattern.

## Justificativa Técnica

O controller é fino para manter regras de negócio no `AuthService`. Isso melhora manutenção, testabilidade e segurança.

---

# 3. Fluxo Interno do Código

## Fluxo de Execução

```txt
HTTP Request
  ↓
AuthController
  ↓
DTO / AuthGuard
  ↓
AuthService
  ↓
HTTP Response
```

## Rotas

| Método | Rota | Proteção | Service chamado |
|---|---|---|---|
| POST | `/auth/login` | Pública | `authService.login()` |
| POST | `/auth/refresh` | Refresh token | `authService.refreshToken()` |
| POST | `/auth/logout` | JWT | `authService.logout()` |
| GET | `/auth/me` | JWT | `authService.getMe()` |
| PATCH | `/auth/trocar-senha` | JWT | `authService.trocarSenha()` |
| PATCH | `/auth/foto-perfil` | JWT | `authService.atualizarFotoPerfil()` |
| PATCH | `/auth/perfil` | JWT | `authService.atualizarPerfil()` |

## Dependências Internas

- `AuthService`;
- `AuthGuard`;
- `LoginDto`;
- `RefreshTokenDto`;
- `TrocarSenhaDto`;
- `AtualizarFotoDto`;
- `AtualizarPerfilDto`;
- `AuthenticatedRequest`;
- `ApiResponse`.

## Dependências Externas

- `@nestjs/common`;
- `@nestjs/swagger`;
- `express`.

---

# 4. Dicionário Técnico

## Variáveis

| Nome | Objetivo |
|---|---|
| `loginDto` | Payload de login |
| `dto` | Payload das rotas de refresh/perfil/senha |
| `req` | Requisição HTTP |
| `req.user.sub` | ID do usuário autenticado |
| `req.user.sid` | ID da sessão atual |

## Funções e Métodos

| Método | Objetivo |
|---|---|
| `login()` | Iniciar sessão |
| `refresh()` | Renovar tokens |
| `logout()` | Revogar sessão atual |
| `getMe()` | Buscar perfil logado |
| `trocarSenha()` | Trocar senha |
| `atualizarFotoPerfil()` | Atualizar foto |
| `atualizarPerfil()` | Atualizar perfil |
| `resolverUserId()` | Extrair `sub` do JWT |

---

# 5. Serviços e Integrações

## APIs

O controller expõe as rotas do domínio `/auth`.

## Banco de Dados

Não acessa banco diretamente. O acesso é feito pelo `AuthService` via `PrismaService`.

## Serviços Externos

Não chama serviços externos diretamente.

---

# 6. Segurança e Qualidade

## Segurança

- rotas sensíveis protegidas por `AuthGuard`;
- logout usa `sid` da sessão atual;
- `resolverUserId()` lança `UnauthorizedException` se não houver `sub`;
- login captura IP e user agent para rastreabilidade.

## Qualidade

- controller fino;
- baixo acoplamento;
- DTOs dedicados;
- Swagger nos endpoints.

## Performance

Não executa processamento pesado, apenas delega ao service.

---

# 7. Regras de Negócio

- login e refresh são públicos do ponto de vista de access token;
- logout, perfil, foto e troca de senha exigem JWT;
- logout deve revogar a sessão atual quando `sid` existe;
- ausência de `sub` invalida a sessão.

---

# 8. Pontos de Atenção

- `req.ip` pode depender de proxy;
- login e refresh devem ter rate limit adequado;
- retornos podem ganhar DTOs mais específicos no futuro;
- um decorator `@CurrentUser()` poderia reduzir uso manual de `@Req()`.

---

# 9. Relação com Outros Módulos

| Módulo | Relação |
|---|---|
| `AuthService` | Executa regras |
| `AuthGuard` | Protege rotas |
| `Common` | Fornece interfaces e `ApiResponse` |
| Frontend | Consome endpoints |

---

# 10. Resumo Técnico Final

O `AuthController` está alinhado com boas práticas NestJS. Ele mantém responsabilidade de camada HTTP e delega as decisões sensíveis ao `AuthService`.

Criticidade: alta.

Complexidade: média.

Próximo documento: `12-auth-service.md`.
