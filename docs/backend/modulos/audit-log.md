# Módulo: Auditoria (audit-log)

---

# 1. Visão Geral

## Objetivo
Registrar e consultar de forma imutável toda ação crítica executada no sistema: criações, atualizações, exclusões, logins, logouts, mudanças de status e operações sensíveis. Fornece trilha forense rastreável para compliance e segurança.

## Responsabilidade
É o **sistema de memória institucional** da API. Nenhum dado auditado pode ser alterado ou deletado — apenas inserido. Outros módulos dependem do `AuditLogService` para registrar suas ações.

## Fluxo de Funcionamento
Dois caminhos de registro existem:
1. **Automático (AuditInterceptor):** intercepta POST/PATCH/PUT/DELETE globalmente
2. **Manual (service direto):** módulos com lógica especial chamam `auditService.registrar()` explicitamente e decoram o controller com `@SkipAudit()`

---

# 2. Arquitetura e Metodologias

## Padrões Identificados
- **Observer Pattern:** `AuditInterceptor` observa todas as respostas HTTP de mutação
- **Fire-and-Forget:** `registrar()` nunca bloqueia o fluxo principal — erros de auditoria são silenciados com `logger.warn`
- **Static Pure Methods:** `serializarSeguro()` e `normalizarParaJson()` são estáticos para evitar criação de closure a cada chamada
- **Decorator Pattern:** `@SkipAudit()` permite que rotas optem por sair da auditoria automática

---

# 3. Fluxo Interno

## AuditInterceptor (automático)

```
1. Intercepta request antes de chegar ao handler
2. Verifica @SkipAudit() via Reflector → se ativo, passa adiante
3. Verifica método HTTP: apenas POST/PATCH/PUT/DELETE são auditados
4. Verifica PATHS_EXCLUIDOS: /api-docs, /health, /audit-log → passa adiante
5. Mapeia método → AuditAcao via ACAO_MAP
6. Extrai entidade via ENTIDADE_MAP (segmento da URL)
7. Extrai registroId do URL (segundo segmento)
8. Extrai autorId, autorNome, autorRole do req.user (JWT)
9. Extrai IP via resolverIp() (header X-Forwarded-For + fallback)
10. Após resposta (tap): sanitiza oldValue (de req.auditOldValue) e newValue (resposta)
11. Chama auditService.registrar() — fire-and-forget
```

## AuditLogService.registrar()

```
1. Recebe AuditOptions com todos os campos
2. Serializa oldValue e newValue via serializarSeguro()
3. Insere em AuditLog via prisma.auditLog.create()
4. Em caso de erro: logger.warn — nunca relança exceção
```

## ACAO_MAP (Heurística de Ação)

```typescript
POST:   path.includes('/alunos/')    → MATRICULAR
        path.includes('/diario/fechar')  → FECHAR_DIARIO
        path.includes('/diario/reabrir') → REABRIR_DIARIO
        path.includes('/auth/login')     → LOGIN
        path.includes('/auth/logout')    → LOGOUT
        (default)                        → CRIAR

PATCH:  path.includes('/restaurar')  → RESTAURAR
        path.includes('/status')      → MUDAR_STATUS
        (default)                     → ATUALIZAR

DELETE: path.includes('/alunos/')    → DESMATRICULAR
        (default)                    → EXCLUIR
```

## ENTIDADE_MAP (Vocabulário de Entidades)

```typescript
{
  turmas: 'Turma', frequencias: 'Frequencia', beneficiaries: 'Aluno',
  usuarios: 'User', auth: 'Auth', 'audit-log': 'AuditLog',
  comunicados: 'Comunicado', contatos: 'Contato',
  'modelos-certificados': 'ModeloCertificado', certificados: 'CertificadoEmitido',
  apoiadores: 'Apoiador', 'site-config': 'SiteConfig',
}
```

> ⚠️ **Ao criar um novo módulo**, adicionar entrada neste mapa para que a entidade seja nomeada corretamente nos logs.

---

# 4. Dicionário Técnico

## Interface `AuditOptions`
```typescript
interface AuditOptions {
  entidade: string;       // Nome do modelo (ex: 'Aluno', 'Turma')
  registroId?: string;    // ID do registro afetado; null para LOGIN/LOGOUT
  acao: AuditAcao;        // Enum da ação realizada
  autorId?: string;       // ID do usuário; null = ação do sistema
  autorNome?: string;     // Snapshot do nome no momento da ação
  autorRole?: string;     // Snapshot do cargo
  ip?: string;            // IP da requisição
  userAgent?: string;     // Browser/client
  oldValue?: unknown;     // Estado anterior
  newValue?: unknown;     // Estado novo
}
```

## `serializarSeguro(val)` — Serialização Safe para JSON

Converte qualquer valor para formato compatível com `Prisma.InputJsonValue`:
- `undefined/null` → retorna `undefined`
- `Date` → converte para ISO string
- `bigint` → converte para string
- `function/symbol` → substitui por `'[nao serializavel]'`
- `ArrayBuffer` → `'[binario N bytes]'`
- Referências circulares → `'[referencia circular]'` (via `WeakSet`)
- Objetos e arrays → recursão normalizada

**Por que estático?** Evita criação de closure por chamada — impacto de performance em sistemas com alto volume de audit events.

## Sanitização no Interceptor

```typescript
const CAMPOS_SENSIVEIS = new Set(['senha', 'password', 'hash', 'passwordhash', 'senhahash', 'token', 'refreshtoken', 'secret']);
// Strings > 500 chars → truncadas
// Arrays > 20 itens → "[Array truncado: N itens]"
// Profundidade máxima: 2 níveis
```

## `midnightBrasilia()` — Fix de Timezone

```typescript
private static midnightBrasilia(): Date {
  const dataBR = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  return new Date(`${dataBR}T00:00:00-03:00`);
}
```
**Por que:** Servidor em produção roda em UTC. `setHours(0,0,0,0)` contaria 3h a menos por dia (UTC midnight ≠ Brasília midnight). O `toLocaleDateString('en-CA')` retorna `YYYY-MM-DD` sem offset.

---

# 5. Endpoints da API

| Método | Rota | Guard | Roles | Descrição |
|---|---|---|---|---|
| `GET` | `/api/audit-log` | `AuthGuard` | `ADMIN` | Lista logs com filtros e paginação |
| `GET` | `/api/audit-log/stats` | `AuthGuard` | `ADMIN` | Estatísticas rápidas do dia |
| `GET` | `/api/audit-log/:entidade/:id` | `AuthGuard` | `ADMIN` | Histórico de um registro específico (máx. 50) |

## `QueryAuditDto` — Filtros disponíveis

```typescript
{
  entidade?: string;    // Ex: 'Aluno', 'Turma'
  registroId?: string;  // ID do registro específico
  autorId?: string;     // ID do usuário que executou a ação
  acao?: AuditAcao;     // Filtrar por tipo de ação
  de?: string;          // Data início (ISO string)
  ate?: string;         // Data fim (ISO string)
  page?: number;        // Default: 1
  limit?: number;       // Default: 20
}
```

---

# 6. Banco de Dados

## Tabela `AuditLog`

- **PK:** `cuid()` (⚠️ tech debt — todos os outros modelos usam `uuid()`)
- **Índices:** `[entidade, registroId]`, `[autorId]`, `[criadoEm]`, `[acao]`
- Campos `oldValue` e `newValue` são do tipo `Json?` — armazenam snapshots do estado

## Regra Crítica
```
AuditLog é IMUTÁVEL. Nunca executar UPDATE ou DELETE nesta tabela.
Apenas INSERT via prisma.auditLog.create().
```

---

# 7. Regras de Negócio

1. **Fire-and-forget obrigatório:** Falha de auditoria NUNCA deve derrubar a operação principal. O sistema continua funcionando sem trilha de auditoria.
2. **Erros de auditoria → logger.warn:** Registrado no servidor, nunca relançado.
3. **Módulos com `@SkipAudit()`** devem chamar `auditService.registrar()` manualmente no service — para garantir contexto mais rico (oldValue específico).
4. **Dados sensíveis nunca nos logs:** `CAMPOS_SENSIVEIS` filtra senhas, tokens e hashes antes de gravar.
5. **Snapshot de autorNome/autorRole:** Salvo no momento da ação para preservar histórico mesmo se o usuário for excluído ou renomeado.

---

# 8. Pontos de Atenção

> [!WARNING]
> **Tech Debt:** `AuditLog.id` usa `cuid()` enquanto todos os demais modelos usam `uuid()`. Não altere sem um script dedicado de migração de dados — mudança direta causaria reset destrutivo da tabela.

> [!NOTE]
> **Performance:** Em sistemas com alto volume de mutações, o `registrar()` é chamado de forma assíncrona (fire-and-forget). Monitorar a tabela `AuditLog` para crescimento excessivo — considerar rotação/arquivamento de logs antigos.

> [!IMPORTANT]
> **Novo módulo:** Ao criar qualquer novo módulo com rotas mutativas, adicionar a entidade no `ENTIDADE_MAP` do `audit.interceptor.ts` para nomeação correta nos logs.

---

# 9. Relação com Outros Módulos

| Módulo | Relação | Detalhe |
|---|---|---|
| `UsersModule` | Consumidor | Registra CRIAR, ATUALIZAR, RESTAURAR, MUDAR_STATUS manualmente |
| `TurmasModule` | Consumidor | Registra CRIAR, ATUALIZAR, MATRICULAR, DESMATRICULAR manualmente |
| `FrequenciasModule` | Consumidor | Registra FECHAR_DIARIO e lotes de frequência manualmente |
| `UploadModule` | Consumidor | Registra CRIAR/EXCLUIR no Cloudinary |
| Todos os módulos | Via Interceptor | Mutações HTTP são auditadas automaticamente |

---

# 10. Resumo Técnico Final

O `audit-log` é a **consciência histórica** do sistema — um ledger append-only de toda ação crítica. A dualidade automático/manual garante tanto cobertura ampla (via interceptor) quanto granularidade específica (via service direto em casos complexos). A estratégia fire-and-forget garante que falhas de auditoria nunca afetem a disponibilidade do sistema.

**Criticidade:** 🔴 Alta (dados de compliance) | **Complexidade:** Média | **Testes:** `audit-log.service.spec.ts`, `audit.interceptor.spec.ts`
