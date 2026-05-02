# Módulo: Autenticação — Fluxo Detalhado

---

# 1. Visão Geral

Documentação focada no **fluxo de autenticação** (diagrama sequencial e decisões de segurança). Para o dicionário completo de métodos e endpoints, consulte [`modulos/auth.md`](modulos/auth.md).

---

# 2. Diagrama de Sequência — Login

```
Cliente                AuthController         AuthService            Banco (PostgreSQL)
  │                         │                      │                        │
  │── POST /auth/login ──►  │                      │                        │
  │   {username, senha}     │──── login(dto) ────► │                        │
  │                         │                      │── findUnique(username) ►│
  │                         │                      │◄─── User ou null ───── │
  │                         │                      │                        │
  │                         │   [se user não existe]│                        │
  │                         │                      │── bcrypt.compare(        │
  │                         │                      │     senha, dummyHash)  │
  │                         │                      │   ← timing normalizado │
  │                         │                      │── UnauthorizedException│
  │                         │                      │                        │
  │                         │   [se user existe]   │                        │
  │                         │                      │── bcrypt.compare(senha, user.senha)
  │                         │                      │                        │
  │                         │   [senha inválida]   │── UnauthorizedException│
  │                         │                      │                        │
  │                         │   [senha válida]     │                        │
  │                         │                      │── UserSession.create ──►│
  │                         │                      │◄─ session criada ─────  │
  │                         │                      │── jwt.sign(payload) ── │
  │◄── {access_token,       │◄─── tokens ─────────│                        │
  │     refresh_token,      │                      │                        │
  │     usuario} ─────────  │                      │                        │
```

---

# 3. Diagrama de Sequência — Refresh Token

```
Cliente                AuthController         AuthService            Banco (PostgreSQL)
  │                         │                      │                        │
  │── POST /auth/refresh ►  │                      │                        │
  │   {refreshToken}        │──refreshToken(raw)──►│                        │
  │                         │                      │── parseRefreshToken() │
  │                         │                      │   "{sessionId}.{secret}"
  │                         │                      │── UserSession.findUnique(sessionId)
  │                         │                      │◄── session ─────────── │
  │                         │                      │                        │
  │                         │   [expirada/revogada]│── UnauthorizedException│
  │                         │                      │                        │
  │                         │   [token válido]     │                        │
  │                         │                      │── bcrypt.compare(secret, hash)
  │                         │   [hash não bate]    │                        │
  │                         │                      │── verifica previousHash│
  │                         │   [bate com anterior]│── revoga sessão ──────►│
  │                         │                      │── UnauthorizedException│
  │                         │                      │                        │
  │                         │   [hash bate]        │── rotaciona token ────►│
  │                         │                      │── jwt.sign(novo) ───── │
  │◄── {novo access_token,  │◄─ novos tokens ─────│                        │
  │     novo refresh_token} │                      │                        │
```

---

# 4. Diagrama de Sequência — Request Protegida (AuthGuard)

```
Cliente                 AuthGuard              JwtService         Banco (PostgreSQL)
  │                         │                      │                    │
  │── GET /api/recurso ──► │                      │                    │
  │   Authorization:        │── extractToken() ── │                    │
  │   Bearer {token}        │── verifyAsync(token)►│                    │
  │                         │◄── payload ─────── │                    │
  │                         │                      │                    │
  │                         │── findUnique(payload.sub) ─────────────►│
  │                         │◄─── {statusAtivo, excluido} ────────── │
  │                         │                      │                    │
  │                     [inativo/excluído]          │                    │
  │◄── 401 Unauthorized ── │                      │                    │
  │                         │                      │                    │
  │                     [ativo]                     │                    │
  │                         │── req.user = payload │                    │
  │                         │── return true ────── │                    │
  │                         │                      │                    │
  │                         (handler é executado)  │                    │
```

---

# 5. Estrutura do Access Token (JWT)

```json
{
  "sub": "uuid-do-usuario",
  "nome": "João da Silva",
  "role": "PROFESSOR",
  "precisaTrocarSenha": false,
  "sid": "uuid-da-sessao",
  "iat": 1746200000,
  "exp": 1746200900
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `sub` | string | ID do usuário (RFC 7519 padrão) |
| `nome` | string | Nome para exibição no frontend |
| `role` | string | Perfil de acesso |
| `precisaTrocarSenha` | boolean | Frontend deve forçar redirect de troca |
| `sid` | string | Session ID (para logout granular) |
| `iat` / `exp` | number | Emitido em / Expira em (Unix timestamp) |

---

# 6. Estrutura do Refresh Token

**Formato enviado ao cliente:** `{sessionId}.{secret}`

```
Exemplo: 550e8400-e29b-41d4-a716-446655440000.a1b2c3d4e5f6...
         └──────────────────────────────────┘ └────────────┘
                     sessionId (UUID v4)         secret (40 bytes hex)
```

**O que é armazenado no banco (`UserSession`):**
```
refreshTokenHash = bcrypt.hash(secret)   ← hash do secret
previousRefreshTokenHash = hash anterior ← janela anti-roubo
```

**Por que esta estrutura?**
- `sessionId` identifica a sessão no banco (sem busca full-table)
- `secret` é validado via bcrypt (resistente a brute-force)
- Formato parsing seguro: split no `.` com validação de UUID v4

---

# 7. Fluxo de Primeiro Login

```
1. Usuário criado pelo admin: precisaTrocarSenha = true
2. Login → access_token contém precisaTrocarSenha: true
3. Frontend detecta o flag e exibe obrigatoriamente a tela de troca de senha
4. PATCH /api/auth/trocar-senha com {senhaAtual, novaSenha, confirmarNovaSenha}
5. AuthService: valida senhaAtual, atualiza hash, seta precisaTrocarSenha: false
6. Próximo login → access_token com precisaTrocarSenha: false → acesso normal
```

---

# 8. Fluxo de Logout

### Logout da sessão atual
```
POST /api/auth/logout
→ Extrai sid do JWT (session ID)
→ Marca UserSession.revokedAt = now()
→ Próximo refresh com esse token → UnauthorizedException
```

### Logout de todos os dispositivos
```
POST /api/auth/logout (sem sid no payload ou rota específica)
→ updateMany: revokedAt = now() em todas as sessões do userId
→ Todos os refresh tokens do usuário tornam-se inválidos
```

---

# 9. Roles e Permissões

| Role | Descrição | Acesso típico |
|---|---|---|
| `ADMIN` | Administrador do sistema | Acesso total |
| `SECRETARIA` | Secretaria escolar | Alunos, turmas, matrículas, frequências |
| `PROFESSOR` | Docente | Suas turmas e frequências |
| `COMUNICACAO` | Equipe de comunicação | Comunicados e conteúdo do site |

### Como usar no controller
```typescript
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN', 'SECRETARIA')
@Post()
async create(@Body() dto: CreateDto, @Req() req: AuthenticatedRequest) {
  return this.service.create(dto, req.user);
}
```

---

# 10. Diagrama de Logout e Detecção de Roubo

```
Token Válido (hash bate) → Rotaciona → previousHash = hashAtual → Novo token

Token Roubado (token anterior apresentado):
  1. Hash atual não bate
  2. Verifica previousHash → BATE
  3. Conclusão: token anterior foi reusado = comprometimento detectado
  4. Ação: revoga sessão imediatamente (revokedAt = now())
  5. Retorna UnauthorizedException
```

---

# 11. Pontos de Atenção

> [!WARNING]
> **Performance:** O `AuthGuard` faz query ao banco a cada request. Em produção com alta carga, considerar cache do estado do usuário (Redis ou cache-manager) com TTL de 30-60s.

> [!IMPORTANT]
> **`precisaTrocarSenha` no JWT:** Se um admin alterar o flag enquanto o usuário está logado, o JWT atual ainda terá o valor antigo até expirar (máx. 15min). Após o próximo refresh, o novo JWT terá o valor correto.

> [!NOTE]
> **Campos legados:** `refreshToken` e `refreshTokenExpiraEm` no modelo `User` são tech debt. Foram substituídos por `UserSession`. Não usar para novas funcionalidades.
