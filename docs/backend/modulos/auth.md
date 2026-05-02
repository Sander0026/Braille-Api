# Módulo: Autenticação (auth)

---

# 1. Visão Geral

## Objetivo
Gerenciar todo o ciclo de vida de autenticação: login, emissão de JWT, rotação de refresh tokens, logout granular por sessão, troca de senha obrigatória e gerenciamento de perfil.

## Responsabilidade
Guardião de acesso de toda a API. Nenhuma rota protegida pode ser acessada sem validação pelo `AuthGuard`. Suporta múltiplos dispositivos simultâneos via tabela `UserSession`.

## Fluxo de Funcionamento
1. Cliente envia credenciais → `AuthController` → `AuthService.login()`
2. Validação de senha com bcrypt + criação de sessão no banco
3. Emite access_token JWT (15min) + refresh_token opaco (7 dias)
4. Refresh token renova access_token silenciosamente com rotação
5. Logout revoga sessão específica ou todas as sessões do usuário

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- **Opaque Refresh Token**: refresh token = `{sessionId}.{secret}` — não é JWT, armazenado como hash bcrypt no banco. Revogável a qualquer momento.
- **Token Rotation Pattern**: a cada refresh, o token anterior é salvo como `previousRefreshTokenHash` para detectar roubo.
- **Timing Attack Prevention (CWE-208)**: `dummyHash` gerado no startup normaliza o tempo de resposta independente de o username existir.
- **Surgical SELECT**: todas as queries usam `select` explícito — `senha` nunca é retornada ao controller.
- **Guard Pattern**: `AuthGuard` (JWT) e `RolesGuard` (RBAC) são decorators declarativos.

## Justificativa Técnica

Refresh tokens opacos permitem revogação instantânea sem esperar expiração do JWT. O `dummyHash` aleatório por startup evita tanto CWE-547 (hardcoded values) quanto CWE-208 (timing). A busca no banco no `AuthGuard` a cada request garante que contas desativadas sejam bloqueadas imediatamente, sem depender do TTL do JWT.

---

# 3. Fluxo Interno do Código

## Login (`POST /api/auth/login`)
```
1. Busca usuário pelo username (SELECT mínimo: id, nome, role, senha...)
2. Se não existe → bcrypt.compare contra dummyHash (normalização de timing)
3. Senha inválida → UnauthorizedException genérica (não revela se username existe)
4. Conta excluída ou inativa → UnauthorizedException
5. Cria UserSession (hash do refreshToken, expiresAt, IP, UserAgent)
6. Limpa colunas legadas (refreshToken, refreshTokenExpiraEm) no User
7. Emite JWT: {sub, nome, role, precisaTrocarSenha, sid}
8. Retorna: {access_token, refresh_token, usuario}
```

## Refresh (`POST /api/auth/refresh`)
```
1. Parse: "{sessionId}.{secret}" → valida UUID v4 + secret ≤ 200 chars
2. Busca UserSession pelo sessionId
3. Verifica: não revogada, não expirada, usuário ativo
4. bcrypt.compare(secret, refreshTokenHash)
5. Se inválido → verifica previousRefreshTokenHash
   - Se bater → sessão revogada imediatamente (token roubado detectado)
6. Rotação: previousHash = hashAtual, gera novo par de tokens
7. Retorna novos {access_token, refresh_token}
```

## AuthGuard (por request protegida)
```
1. Extrai Bearer token do header Authorization
2. jwtService.verifyAsync(token) — secret via ConfigService (nunca process.env direto)
3. Busca User no banco (verifica statusAtivo e excluido em tempo real)
4. Conta desativada após emissão → rejeita imediatamente
5. Popula req.user com payload tipado
```

## Dependências Internas

| Dependência | Uso |
|---|---|
| `PrismaService` | Queries em `User` e `UserSession` |
| `JwtService` | Assinar e verificar tokens |
| `UploadService` | Deletar foto de perfil antiga do Cloudinary |

## Dependências Externas

| Biblioteca | Uso |
|---|---|
| `bcrypt` | Hash de senhas e refresh tokens |
| `@nestjs/jwt` | JWT sign/verify com secret via ConfigService |
| `crypto` (Node nativo) | `randomBytes`, `randomUUID` |

---

# 4. Dicionário Técnico

## Constantes

| Constante | Valor | Descrição |
|---|---|---|
| `REFRESH_TOKEN_TTL_DIAS` | `7` | Validade dos refresh tokens em dias |
| `AUTH_SELECT` | `{id, nome, role, statusAtivo, excluido, precisaTrocarSenha}` | SELECT mínimo para autenticação |
| `PERFIL_SELECT` | `{id, nome, username, email, role, fotoPerfil, statusAtivo, criadoEm}` | Campos públicos do perfil |
| `dummyHash` | Hash bcrypt de `randomBytes(16)` | Gerado no startup para normalização de timing |

## Interface `SessionMetadata`
```typescript
interface SessionMetadata { ip?: string; userAgent?: string; }
```

## Interface `RefreshTokenPair`
```typescript
interface RefreshTokenPair {
  sessionId: string;          // UUID da sessão no banco
  rawRefreshToken: string;    // "{sessionId}.{secret}" → enviado ao cliente
  rawSecret: string;          // Secret aleatório (40 bytes hex)
  hashedRefreshToken: string; // bcrypt(secret) → salvo no banco
  refreshTokenExpiraEm: Date;
}
```

## Interface `AuthenticatedRequest` (common/interfaces)
```typescript
interface AuthenticatedRequest extends Request {
  user?: {
    sub: string;                 // User ID
    nome: string;
    role: string;
    precisaTrocarSenha: boolean;
    sid: string;                 // Session ID
    email?: string;
  };
  auditOldValue?: Record<string, unknown>;
}
```

## Métodos Principais

| Método | Parâmetros | Retorno | Exceções |
|---|---|---|---|
| `login()` | `LoginDto` + metadados | `{access_token, refresh_token, usuario}` | `UnauthorizedException` |
| `refreshToken()` | String raw do token | `{access_token, refresh_token}` | `UnauthorizedException` |
| `logout()` | userId + sessionId? | `ApiResponse<null>` | — |
| `trocarSenha()` | userId + `TrocarSenhaDto` | `ApiResponse<null>` | `BadRequestException`, `NotFoundException` |
| `getMe()` | userId | `ApiResponse<perfil>` | `NotFoundException` |
| `atualizarFotoPerfil()` | userId + URL ou null | `ApiResponse` | `NotFoundException` |
| `atualizarPerfil()` | userId + `AtualizarPerfilDto` | `ApiResponse<perfil>` | `BadRequestException` |

---

# 5. Endpoints da API

| Método | Rota | Guard | Roles | Descrição |
|---|---|---|---|---|
| `POST` | `/api/auth/login` | Público | — | Autenticar |
| `POST` | `/api/auth/refresh` | Público | — | Renovar access token |
| `POST` | `/api/auth/logout` | `AuthGuard` | Qualquer | Encerrar sessão atual |
| `GET` | `/api/auth/me` | `AuthGuard` | Qualquer | Dados do usuário logado |
| `PATCH` | `/api/auth/trocar-senha` | `AuthGuard` | Qualquer | Alterar própria senha |
| `PATCH` | `/api/auth/foto-perfil` | `AuthGuard` | Qualquer | Atualizar foto |
| `PATCH` | `/api/auth/perfil` | `AuthGuard` | Qualquer | Atualizar nome/e-mail |

---

# 6. Banco de Dados

## Tabela `User` (campos de auth)

| Campo | Tipo | Descrição |
|---|---|---|
| `senha` | String | bcrypt hash (10 rounds login, 12 rounds seed) |
| `precisaTrocarSenha` | Boolean | Obriga redirect de troca no frontend |
| `statusAtivo` | Boolean | `false` bloqueia login imediatamente |
| `excluido` | Boolean | Soft delete permanente |
| `refreshToken` | String? | ⚠️ **Legado** — descontinuado |
| `refreshTokenExpiraEm` | DateTime? | ⚠️ **Legado** — descontinuado |

## Tabela `UserSession`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | PK = sessionId (embedded no refresh token) |
| `userId` | UUID | FK User |
| `refreshTokenHash` | String | bcrypt do secret atual |
| `previousRefreshTokenHash` | String? | bcrypt do secret anterior (janela anti-roubo) |
| `expiresAt` | DateTime | Expiração absoluta |
| `revokedAt` | DateTime? | Preenchido no logout |
| `userAgent` | String? | Browser/app rastreado |
| `ip` | String? | IP do login |

---

# 7. Segurança

| Ataque | Contramedida | Localização |
|---|---|---|
| Timing Attack (CWE-208) | `dummyHash` normaliza tempo de resposta | Constructor `AuthService` |
| Username Enumeration | Mensagem de erro genérica | `login()` |
| JWT secret indefinido | ConfigService — nunca `process.env` direto | `auth.module.ts` |
| Conta desativada com JWT válido | Busca DB em tempo real | `AuthGuard.canActivate()` |
| Refresh token roubado | Verificação de `previousRefreshTokenHash` | `refreshToken()` |
| Sessão não invalidada | `revokedAt` na UserSession | `logout()` |

## JWT Payload
```typescript
{ sub: string; nome: string; role: Role; precisaTrocarSenha: boolean; sid: string; }
```

---

# 8. Regras de Negócio

1. **Primeiro login obrigatório:** Novos usuários têm `precisaTrocarSenha: true`. O frontend deve bloquear qualquer navegação até a troca ocorrer.
2. **Logout granular vs. total:** Com `sid` no JWT → revoga apenas sessão atual. Sem `sid` → revoga todas as sessões do usuário.
3. **Revogação imediata:** Desativar conta bloqueia acesso instantaneamente (sem esperar JWT expirar).
4. **Token anterior:** Uso de token rotacionado (anterior) → sessão revogada imediatamente (indica comprometimento).
5. **E-mail único:** `atualizarPerfil()` valida conflito de e-mail antes de salvar.

---

# 9. Pontos de Atenção

> [!WARNING]
> **Performance:** O `AuthGuard` faz query ao banco a cada request protegida. Em alta carga, considere cache de estado do usuário (TTL de 30-60s).

> [!NOTE]
> **Tech Debt:** Os campos `refreshToken` e `refreshTokenExpiraEm` no modelo `User` são legados. Devem ser removidos via migration após confirmar que nenhuma sessão ativa depende deles.

> [!IMPORTANT]
> **Multi-instância:** Em deploys com múltiplas instâncias (escalonamento horizontal), cada instância terá um `dummyHash` diferente. Isso é seguro — o hash é apenas para normalização de tempo, nunca para comparação real de credenciais.

---

# 10. Relação com Outros Módulos

| Módulo | Relação | Detalhe |
|---|---|---|
| `UsersModule` | Consumidor | Usa `AuthGuard` + `RolesGuard` |
| `UploadModule` | Dependência | `atualizarFotoPerfil()` deleta imagem antiga |
| `AuditLogModule` | Passivo | Interceptor registra LOGIN/LOGOUT automaticamente |
| Todos os módulos | Dependência | `AuthGuard` e `RolesGuard` são reutilizados globalmente |

---

# 11. Resumo Técnico Final

Módulo de autenticação de **nível profissional** com múltiplas camadas de defesa. Implementa padrões de segurança que vão além do básico: tokens opacos rotativos, detecção de roubo, normalização de timing e revogação em tempo real. Qualquer alteração exige revisão de segurança e testes de regressão completos.

**Criticidade:** 🔴 Máxima | **Complexidade:** Alta | **Testes:** `auth.service.spec.ts`, `auth.controller.spec.ts`, `auth.module.spec.ts`
