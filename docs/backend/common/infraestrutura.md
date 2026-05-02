# Módulo: Common — Interceptors, Filters, Guards e Helpers

---

# 1. AuditInterceptor

**Arquivo:** `src/common/interceptors/audit.interceptor.ts`

## Objetivo
Interceptar automaticamente todas as requisições HTTP mutativas (POST/PATCH/PUT/DELETE) e registrar no AuditLog sem que os controllers precisem de código de auditoria explícito.

## Fluxo

```typescript
// 1. Verifica @SkipAudit() no handler ou controller
// 2. Filtra: apenas POST, PATCH, PUT, DELETE
// 3. Filtra: ignora /api-docs, /health, /audit-log
// 4. Extrai: entidade (ENTIDADE_MAP), ação (ACAO_MAP), registroId (URL)
// 5. Extrai: autor (req.user), IP (X-Forwarded-For), userAgent
// 6. tap() na resposta: sanitiza payload, chama auditService.registrar()
```

## ACAO_MAP (Heurística HTTP → AuditAcao)
```
POST /turmas/:id/alunos/:id  → MATRICULAR
POST /diario/fechar          → FECHAR_DIARIO
POST /diario/reabrir         → REABRIR_DIARIO
POST /auth/login             → LOGIN
POST /auth/logout            → LOGOUT
POST (default)               → CRIAR
PATCH /restaurar             → RESTAURAR
PATCH /status                → MUDAR_STATUS
PATCH (default)              → ATUALIZAR
DELETE /turmas/:id/alunos    → DESMATRICULAR
DELETE (default)             → EXCLUIR
```

## ENTIDADE_MAP
```typescript
{
  turmas: 'Turma', frequencias: 'Frequencia', beneficiaries: 'Aluno',
  usuarios: 'User', auth: 'Auth', comunicados: 'Comunicado',
  contatos: 'Contato', 'modelos-certificados': 'ModeloCertificado',
  certificados: 'CertificadoEmitido', apoiadores: 'Apoiador',
  'site-config': 'SiteConfig', laudos: 'Laudo', atestados: 'Atestado',
}
```

## Sanitização de Payload
```typescript
const CAMPOS_SENSIVEIS = new Set(['senha', 'password', 'hash', 'token', 'refreshtoken', 'secret']);
// Strings > 500 chars → truncadas
// Arrays > 20 itens → "[Array truncado: N itens]"
// Profundidade máxima: 2 níveis de aninhamento
```

## Decorator `@SkipAudit()`
```typescript
import { SetMetadata } from '@nestjs/common';
export const SKIP_AUDIT_KEY = 'skipAudit';
export const SkipAudit = () => SetMetadata(SKIP_AUDIT_KEY, true);
```
Use em rotas que fazem auditoria manual no service para evitar registro duplicado.

---

# 2. PrismaExceptionFilter

**Arquivo:** `src/common/filters/prisma-exception.filter.ts`

## Objetivo
Capturar exceções do Prisma antes que detalhes internos do banco sejam expostos ao cliente (CWE-209 — Information Disclosure).

## Mapeamento de Códigos Prisma

| Código Prisma | Causa | Mensagem pública retornada |
|---|---|---|
| `P2002` | Unique constraint violation | `"Violação de regra única. O campo informado já está em uso."` |
| `P2003` | Foreign key constraint failed | `"Operação inválida. O registro referenciado não existe."` |
| `P2025` | Record not found | `"O registro solicitado não foi encontrado."` |
| `P2016` | Query interpretation error | `"Requisição inválida. Verifique os dados enviados."` |
| `P2014` | Relation violation | `"Conflito de relação. Verifique as dependências do registro."` |
| Default | Qualquer outro erro Prisma | `"Erro interno de banco de dados. Tente novamente."` |

**Importante:** O detalhe real do erro é logado como `logger.warn` no servidor — nunca enviado ao cliente.

## PrismaValidationFilter
Captura `PrismaClientValidationError` (dados inválidos passados para o Prisma) e retorna 400 com mensagem genérica.

---

# 3. AuthGuard

**Arquivo:** `src/auth/auth.guard.ts`

## Objetivo
Validar o Bearer token JWT em cada request protegida e verificar em tempo real se a conta ainda está ativa.

## Fluxo
```
1. Extrai token do header: Authorization: Bearer {token}
2. jwtService.verifyAsync(token) — usa secret do ConfigService (nunca process.env)
3. Busca User no banco: SELECT id, statusAtivo, excluido
4. Se inativo ou excluído → UnauthorizedException imediata
5. Popula req.user com payload JWT tipado como AuthenticatedRequest
```

**Segurança crítica:** A query ao banco a cada request garante revogação imediata de contas desativadas, sem esperar o TTL do JWT expirar.

---

# 4. RolesGuard

**Arquivo:** `src/auth/roles.guard.ts`

## Objetivo
Verificar se o usuário autenticado possui o perfil necessário para acessar a rota decorada com `@Roles()`.

## Fluxo
```
1. Lê @Roles() do handler/controller via Reflector
2. Se não houver @Roles() → qualquer usuário logado pode acessar
3. Verifica user.role (do JWT) contra a lista de roles permitidas
4. Se não autorizado → ForbiddenException com mensagem clara
```

## Uso
```typescript
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN', 'SECRETARIA')
@Post()
create() { ... }
```

---

# 5. Helpers Compartilhados

## `data.helper.ts`

### `calcularCargaHorariaTotal(dataInicio, dataFim, gradeHoraria)`
Calcula carga horária total da turma iterando dia a dia entre as datas. Agrupa minutos por dia da semana e acumula. Retorna string legível ("40 horas", "2 horas e 30 minutos").

### `formatarDataBR(isoStr)`
Converte ISO 8601 para formato `DD/MM/AAAA` sem deslocamento de timezone. Usado em certificados.

### `preencherTemplateTexto(template, vars)`
Substitui tags `{{TAG}}` no template de certificado:
- `{{ALUNO}}`, `{{NOME}}`, `{{APOIADOR}}`, `{{PARCEIRO}}`, `{{NOME_APOIADOR}}` → `nomeDestinatario`
- `{{NOME_EVENTO}}`, `{{MOTIVO}}` → `nomeEvento`
- `{{DATA_EVENTO}}`, `{{DATA}}` → `dataEvento`
- `{{DATA_EMISSAO}}` → `dataEmissao` (automática)

## `documento.helper.ts`

### `validarCpf(cpf)`
Valida CPF via algoritmo Módulo 11 da Receita Federal. Aceita com ou sem máscara. Rejeita sequências homogêneas (000.000.000-00).

### `validarCnpj(cnpj)`
Valida CNPJ via Módulo 11. Aceita com ou sem máscara. Rejeita sequências homogêneas.

## `matricula.helper.ts`

### `gerarMatriculaAluno(prisma)`
Gera matrícula única no formato `A{ANO}{SEQUENCIAL4DIGITS}`. Ex: `A20260001`. Busca o maior número usado no ano atual e incrementa.

---

# 6. Interfaces Compartilhadas

## `AuthenticatedRequest`
```typescript
// src/common/interfaces/authenticated-request.interface.ts
interface AuthenticatedRequest extends Request {
  user?: { sub: string; nome: string; role: string; precisaTrocarSenha: boolean; sid: string; };
  auditOldValue?: Record<string, unknown>;
}
```

## `AuditUser`
```typescript
// src/common/interfaces/audit-user.interface.ts
interface AuditUser {
  sub: string;      // User ID do JWT
  nome: string;
  role: string;
  ip?: string;
  userAgent?: string;
}
```

## `ApiResponse<T>`
```typescript
// src/common/dto/api-response.dto.ts
class ApiResponse<T> {
  constructor(
    public sucesso: boolean,
    public dados: T,
    public mensagem: string,
  ) {}
}
```
Padrão de envelope de resposta usado nos endpoints principais.

---

# 7. Pontos de Atenção

> [!IMPORTANT]
> **Novo módulo:** Sempre adicionar a entidade no `ENTIDADE_MAP` do `AuditInterceptor`. Sem isso, logs de auditoria mostrarão a entidade como `undefined`.

> [!NOTE]
> **`@SkipAudit()` + auditoria manual:** Se o controller usar `@SkipAudit()`, o service **deve** chamar `auditService.registrar()` manualmente. Sem isso, a ação não será auditada.

> [!WARNING]
> **PrismaExceptionFilter não captura erros custom:** Exceptions lançadas explicitamente no service (ex: `NotFoundException`, `BadRequestException`) passam direto para o cliente sem passar pelo filter — pois são `HttpException`, não `PrismaClientKnownRequestError`.
