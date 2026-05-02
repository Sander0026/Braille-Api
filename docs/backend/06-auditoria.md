# Sistema de Auditoria — Funcionamento Completo

---

# 1. Visão Geral

O sistema de auditoria da Braille-Api registra **toda ação crítica** de forma imutável. É composto por dois componentes:

1. **`AuditInterceptor`** — intercepta automaticamente todas as mutações HTTP
2. **`AuditLogService`** — serviço de escrita e consulta dos logs

---

# 2. Dois Modos de Registro

```
┌─────────────────────────────────────────────────────────────────┐
│  MODO AUTOMÁTICO                    MODO MANUAL                 │
│  (padrão — 90% dos casos)          (@SkipAudit + service)       │
│                                                                  │
│  Controller não sabe               Controller usa @SkipAudit()  │
│  que está sendo auditado           Service chama registrar()    │
│                                    com oldValue preciso         │
│  Vantagem: zero boilerplate        Vantagem: contexto rico      │
│  Desvantagem: oldValue genérico    Desvantagem: código extra    │
└─────────────────────────────────────────────────────────────────┘
```

---

# 3. Como o AuditInterceptor Funciona

### Filtros (o que NÃO audita)
```typescript
// Métodos ignorados
GET, HEAD, OPTIONS

// Paths ignorados
'/api-docs'
'/health'
'/audit-log'  ← evita recursão infinita
```

### Heurística de Ação (ACAO_MAP)
```
POST  + /turmas/:id/alunos/:id    → MATRICULAR
POST  + /diario/fechar            → FECHAR_DIARIO
POST  + /diario/reabrir           → REABRIR_DIARIO
POST  + /auth/login               → LOGIN
POST  + /auth/logout              → LOGOUT
POST  (default)                   → CRIAR

PATCH + /restaurar                → RESTAURAR
PATCH + /status                   → MUDAR_STATUS
PATCH (default)                   → ATUALIZAR

DELETE + /turmas/:id/alunos/:id   → DESMATRICULAR
DELETE (default)                  → EXCLUIR
```

### Extração de Entidade (ENTIDADE_MAP)
O interceptor pega o primeiro segmento do path após `/api/`:
```
/api/turmas/123        → 'turmas' → 'Turma'
/api/beneficiaries/456 → 'beneficiaries' → 'Aluno'
/api/auth/login        → 'auth' → 'Auth'
```

### Extração de registroId
```
/api/turmas/abc-123-def   → registroId = 'abc-123-def'
/api/turmas               → registroId = undefined
/api/auth/login           → registroId = null (LOGIN/LOGOUT)
```

### Sanitização do Payload
```typescript
// Campos removidos (case-insensitive)
['senha', 'password', 'hash', 'passwordhash', 'senhahash', 'token', 'refreshtoken', 'secret']

// Strings longas truncadas
string.length > 500 → "[truncado: N chars]"

// Arrays grandes truncados
array.length > 20 → "[Array truncado: N itens]"

// Profundidade máxima
2 níveis de aninhamento de objetos
```

---

# 4. Como Adicionar um Novo Módulo ao Sistema de Auditoria

### Passo 1 — Adicionar ao ENTIDADE_MAP

Arquivo: `src/common/interceptors/audit.interceptor.ts`

```typescript
const ENTIDADE_MAP: Record<string, string> = {
  // ... existentes ...
  'meu-modulo': 'MinhaEntidade',  // ← adicionar aqui
};
```

### Passo 2 — Verificar o ACAO_MAP

Se o módulo tiver ações especiais (ex: um endpoint de "aprovar"), verifique se a URL bate com alguma heurística existente ou adicione uma nova:

```typescript
// Adicionar no ACAO_MAP se necessário
if (path.includes('/aprovar')) return AuditAcao.MUDAR_STATUS;
```

### Passo 3 (Opcional) — Auditoria Manual para Mais Contexto

```typescript
// No controller
@UseGuards(AuthGuard)
@SkipAudit()           // ← pula o interceptor automático
@Post()
async create(@Body() dto: CreateDto, @Req() req: AuthenticatedRequest) {
  return this.meuService.create(dto, req.user);
}

// No service
async create(dto: CreateDto, auditUser: AuditUser) {
  const registro = await this.prisma.minhaEntidade.create({ data: dto });
  
  // Registra manualmente com contexto rico
  this.auditService.registrar({
    entidade: 'MinhaEntidade',
    registroId: registro.id,
    acao: AuditAcao.CRIAR,
    autorId: auditUser.sub,
    autorNome: auditUser.nome,
    autorRole: auditUser.role,
    ip: auditUser.ip,
    userAgent: auditUser.userAgent,
    newValue: registro,
  });
  
  return registro;
}
```

---

# 5. Consultando Logs de Auditoria

### Endpoint de listagem
```http
GET /api/audit-log?entidade=Aluno&acao=CRIAR&de=2026-01-01&ate=2026-12-31&page=1&limit=20
Authorization: Bearer {token_admin}
```

**Filtros disponíveis:**
| Parâmetro | Tipo | Exemplo |
|---|---|---|
| `entidade` | string | `Aluno`, `Turma`, `User` |
| `registroId` | string | UUID do registro |
| `autorId` | string | UUID do usuário autor |
| `acao` | AuditAcao | `CRIAR`, `ATUALIZAR`, `EXCLUIR` |
| `de` | ISO date | `2026-01-01` |
| `ate` | ISO date | `2026-12-31` |
| `page` | number | `1` |
| `limit` | number | `20` |

### Histórico de um registro específico
```http
GET /api/audit-log/Aluno/abc-123-def
Authorization: Bearer {token_admin}
```
Retorna até 50 entradas do histórico do registro, ordenadas por data decrescente.

### Estatísticas
```http
GET /api/audit-log/stats
Authorization: Bearer {token_admin}
```
Retorna: `totalLogs`, `logsHoje` (fuso Brasília), `topAcoes` (10 mais frequentes).

---

# 6. Diferença: autorId null vs. preenchido

| `autorId` | Significado |
|---|---|
| UUID de usuário | Ação executada por funcionário autenticado |
| `null` | Ação do sistema (ex: scheduler de turmas, seed) |

---

# 7. Imutabilidade do AuditLog

**Regra absoluta:** A tabela `AuditLog` é append-only.

```typescript
// ✅ Único permitido
await prisma.auditLog.create({ data: {...} });

// ❌ NUNCA fazer
await prisma.auditLog.update(...);
await prisma.auditLog.delete(...);
await prisma.auditLog.deleteMany(...);
```

Se precisar "corrigir" um log incorreto, crie um novo log explicando a correção.

---

# 8. Fire-and-Forget — Por que Erros são Silenciados

```typescript
async registrar(opts: AuditOptions): Promise<void> {
  try {
    await this.prisma.auditLog.create({ data: {...} });
  } catch (err) {
    // ← NUNCA relança a exceção
    this.logger.warn(`Falha ao registrar auditoria [${opts.entidade}/${opts.acao}]: ${msg}`);
  }
}
```

**Por que:** Auditoria é observabilidade, não regra de negócio. Falhar a criação de um aluno porque o banco de auditoria está temporariamente lento seria uma política incorreta de disponibilidade. O sistema operacional continua; a falha fica registrada no log do servidor.

---

# 9. Tech Debt: cuid() vs uuid()

O `AuditLog.id` usa `cuid()` enquanto todos os outros modelos usam `uuid()`. Esta divergência existe porque o modelo foi criado antes da padronização do projeto.

**Impacto atual:** Nenhum impacto funcional — ambos são IDs únicos válidos.

**Resolução futura:** Script de migração dedicado (não via `prisma migrate`) para converter IDs e garantir consistência. Documentado como tech debt.

---

# 10. Pontos de Atenção

> [!IMPORTANT]
> **Novo módulo sem ENTIDADE_MAP:** O log será criado com `entidade: undefined`. Isso quebra filtros e histórico por entidade. Sempre adicionar no mapa.

> [!NOTE]
> **Lote de frequências:** A auditoria do `salvarLote()` é disparada fora da transação (no background), para não causar contenção de conexão no pool do Prisma. Ver `docs/backend/modulos/frequencias.md`.

> [!WARNING]
> **Crescimento da tabela:** Em produção, o AuditLog cresce continuamente. Monitorar tamanho e considerar archiving de logs com mais de X meses para tabela de arquivo separada.
