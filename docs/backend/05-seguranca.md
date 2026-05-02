# Segurança — Medidas Implementadas

---

# 1. Visão Geral

A Braille-Api gerencia **dados sensíveis de pessoas com deficiência visual**: laudos médicos, dados socioeconômicos, localização e informações de saúde. O nível de segurança implementado reflete essa responsabilidade. Este documento cataloga cada medida, sua localização no código e o ataque que previne.

---

# 2. Mapa Completo de Segurança

## 2.1 Segurança de Rede e Transporte

### Helmet (HTTP Security Headers)
**Arquivo:** `src/main.ts`
```typescript
app.use(helmet());
```
**Protege contra:** Clickjacking (X-Frame-Options), MIME sniffing (X-Content-Type-Options), XSS (X-XSS-Protection), fingerprinting do servidor.
**Por que:** Sem Helmet, o servidor anuncia explicitamente que usa Express/NestJS, facilitando ataques direcionados.

### CORS Whitelist Explícita
**Arquivo:** `src/main.ts`
```typescript
origin: ['http://localhost:4200', 'https://instituto-luizbraille.vercel.app', process.env.FRONTEND_URL]
```
**Protege contra:** Cross-Origin Request Forgery (CSRF parcial), requisições de origens não autorizadas.
**Decisão:** `process.env.FRONTEND_URL` permite configuração dinâmica por ambiente sem alterar código.

### GZIP Compression
**Arquivo:** `src/main.ts`
```typescript
app.use(compression());
```
**Impacto:** Reduz o payload das respostas (~70%), diminuindo a janela de interceptação de tráfego.

---

## 2.2 Autenticação e Sessões

### Anti-Timing Attack (CWE-208)
**Arquivo:** `src/auth/auth.service.ts`
```typescript
private readonly dummyHash: string = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);
// ...
const senhaParaComparar = user?.senha ?? this.dummyHash;
const isPasswordValid = await bcrypt.compare(loginDto.senha, senhaParaComparar);
```
**Protege contra:** Timing attack — um atacante mede o tempo de resposta para descobrir se um username existe. Com `dummyHash`, o tempo é sempre ~100ms independente de o usuário existir.
**Observação:** O hash é gerado com `randomBytes` no startup — nunca hardcoded (evita CWE-547).

### Mensagem de Erro Genérica no Login
**Arquivo:** `src/auth/auth.service.ts`
```typescript
throw new UnauthorizedException('Nome de usuário ou senha incorretos.');
```
**Protege contra:** Username enumeration — se a mensagem fosse "usuário não encontrado" vs "senha incorreta", um atacante saberia quais usernames existem.

### JWT com Secret via ConfigService
**Arquivo:** `src/auth/auth.guard.ts`
```typescript
const payload = await this.jwtService.verifyAsync(token);
// NÃO: jwtService.verifyAsync(token, { secret: process.env.JWT_SECRET })
```
**Protege contra:** OWASP A2 — se `process.env.JWT_SECRET` for `undefined`, passar diretamente faria o JWT aceitar qualquer token sem validar assinatura. O `ConfigService` garante que o secret está presente.

### Revogação em Tempo Real de Conta
**Arquivo:** `src/auth/auth.guard.ts`
```typescript
const userAtivo = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { statusAtivo, excluido } });
if (!userAtivo || !userAtivo.statusAtivo || userAtivo.excluido) throw new UnauthorizedException(...);
```
**Protege contra:** Acesso com JWT válido após desativação da conta. Sem isso, um usuário demitido continuaria com acesso por até 15 minutos (TTL do JWT).

### Detecção de Refresh Token Roubado
**Arquivo:** `src/auth/auth.service.ts`
```typescript
const isReuseRefreshAnterior = await this.compararSegredoRefresh(secret, session.previousRefreshTokenHash);
if (isReuseRefreshAnterior) {
  await this.revogarSessao(session.id); // Revoga sessão imediatamente
}
```
**Protege contra:** Roubo de refresh token — se alguém usa um token já rotacionado (token anterior), indica comprometimento. A sessão inteira é revogada como medida de contenção.

### Formato Seguro do Refresh Token
**Arquivo:** `src/auth/auth.service.ts`
```typescript
private parseRefreshToken(rawRefreshToken: string) {
  const [sessionId, secret, extra] = rawRefreshToken.split('.');
  if (!sessionId || !secret || extra || !this.isUuidV4(sessionId) || secret.length > 200) {
    throw new UnauthorizedException(...);
  }
}
```
**Protege contra:** Injeção via token malformado. Valida: sessionId é UUID v4 válido, secret não está vazio, sem partes extras, tamanho razoável.

---

## 2.3 Autorização e Controle de Acesso (RBAC)

### RolesGuard
**Arquivo:** `src/auth/roles.guard.ts`
```typescript
const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [handler, class]);
if (!requiredRoles) return true; // Rota pública
if (!requiredRoles.includes(user.role)) throw new ForbiddenException(...);
```
**Roles disponíveis:** `ADMIN`, `SECRETARIA`, `PROFESSOR`, `COMUNICACAO`
**Uso:** `@Roles('ADMIN', 'SECRETARIA')` no controller.

### Proteção de Auto-Exclusão
**Arquivo:** `src/users/users.service.ts`
```typescript
if (autorId && autorId === id) {
  throw new BadRequestException('Não é possível desativar o usuário que está logado.');
}
```
**Protege contra:** Admin acidentalmente se auto-desativar, bloqueando o acesso ao sistema.

---

## 2.4 Validação e Sanitização de Dados

### ValidationPipe Global Estrito
**Arquivo:** `src/main.ts`
```typescript
new ValidationPipe({
  whitelist: true,            // Remove campos não declarados no DTO
  forbidNonWhitelisted: true, // 400 se enviarem campos extras
  transform: true,
})
```
**Protege contra:** Mass assignment — campos maliciosos extras são automaticamente descartados antes de chegar ao service.

### Validação de Ambiente no Boot
**Arquivo:** `src/common/config/env.validation.ts`
**Protege contra:** Deploy com variáveis faltando. Se `JWT_SECRET` < 32 chars em produção, o servidor **recusa iniciar**.

### Filtros de Exceção Prisma (CWE-209)
**Arquivo:** `src/common/filters/prisma-exception.filter.ts`
```typescript
// Mensagem pública — NUNCA expõe detalhes do banco
const MSG_PUBLICAS = {
  P2002: 'Violação de regra única. O campo informado já está em uso.',
  P2025: 'O registro solicitado não foi encontrado.',
}
// Log detalhado → apenas no servidor
this.logger.warn(`Prisma ${exception.code} | target: ... | ${exception.message}`);
```
**Protege contra:** Information disclosure — mensagens brutas do Prisma contêm nomes de tabelas, colunas e queries SQL internas. Nunca devem chegar ao cliente.

### Validação de CPF e CNPJ
**Arquivo:** `src/common/helpers/documento.helper.ts`
**Algoritmo:** Módulo 11 da Receita Federal. Rejeita sequências homogêneas (111.111.111-11).

---

## 2.5 Auditoria e Observabilidade

### Campos Sensíveis Removidos do Audit Log
**Arquivo:** `src/common/interceptors/audit.interceptor.ts`
```typescript
const CAMPOS_SENSIVEIS = new Set(['senha', 'password', 'hash', 'token', 'refreshtoken', 'secret']);
// Strings > 500 chars truncadas (evita blobs base64)
// Arrays > 20 itens truncados
```
**Protege contra:** Vazamento de dados sensíveis nos logs de auditoria.

### Audit Log Imutável
**Arquivo:** `prisma/schema.prisma`
**Regra:** `AuditLog` nunca deve ser alterado ou deletado. Apenas INSERT. Preserva trilha forense.

---

## 2.6 Criptografia

### Senhas com bcrypt
- **Login e criação de usuários:** 10 rounds (`bcrypt.hash(senha, 10)`)
- **Seed do admin:** 12 rounds (`BCRYPT_ROUNDS = 12`) — padrão OWASP atual

### Refresh Token Hash
- Secret de 40 bytes hexadecimais gerado com `crypto.randomBytes(40)`
- Hash com bcrypt antes de salvar no banco
- **Nunca** o secret bruto é armazenado

---

## 2.7 Rate Limiting (Anti-Força Bruta)

**Arquivo:** `src/app.module.ts`
```typescript
ThrottlerModule.forRootAsync({
  ttl: 60000,   // Janela: 60 segundos
  limit: 30,    // Máx: 30 requests por janela por IP
})
```
**Protege contra:** Ataques de força bruta em endpoints de login, brute-force de IDs em rotas CRUD.
**Configurável:** `THROTTLER_TTL` e `THROTTLER_LIMIT` via variáveis de ambiente.

---

## 2.8 Segurança de Credenciais (Anti-Hardcoding)

| Arquivo | Técnica | Risco Evitado |
|---|---|---|
| `auth.service.ts` | `dummyHash` com `randomBytes(16)` | CWE-547 |
| `admin-seeder.ts` | Senha SEMPRE de `process.env.SENHA_PADRAO_ADMIN` | CWE-547 |
| `users.service.ts` | Senha de `process.env.SENHA_PADRAO_USUARIO` | CWE-547 |
| `auth.guard.ts` | Secret JWT via ConfigService | OWASP A2 |

---

# 3. Matriz de Riscos Residuais

| Risco | Severidade | Status |
|---|---|---|
| Ausência de monitoramento em PRD (Sentry) | 🔴 Alta | ⚠️ Não implementado no backend |
| `AuthGuard` sem cache → query por request | 🟡 Média | ⚠️ Possível gargalo em escala |
| Campos legados (`refreshToken` no User) | 🟡 Média | 📋 Tech debt documentado |
| Swagger exposto sem proteção de IP | 🟢 Baixa | ✅ Apenas em dev (não publicado em PRD) |
| Sem WAF (Web Application Firewall) | 🟡 Média | 📋 Responsabilidade do Render/infra |

---

# 4. Checklist de Segurança para Novos Endpoints

Ao criar um novo controller/rota, verifique:

- [ ] A rota tem `@UseGuards(AuthGuard)` se for protegida?
- [ ] Roles restritas têm `@UseGuards(RolesGuard)` + `@Roles(...)`?
- [ ] O DTO usa `class-validator` decorators para todos os campos?
- [ ] O service não retorna `senha`, `refreshToken` ou outros campos sensíveis?
- [ ] Exceções de negócio lançam HTTP exceptions tipadas (não Error genérico)?
- [ ] Queries Prisma usam `select` explícito (não `findUnique` sem select)?
- [ ] Novo módulo foi adicionado ao `ENTIDADE_MAP` no `audit.interceptor.ts`?
