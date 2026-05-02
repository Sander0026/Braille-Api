# Variáveis de Ambiente — Referência Completa

---

# 1. Visão Geral

Todas as variáveis são carregadas pelo `ConfigModule` do NestJS e **validadas em tempo de boot** pelo `src/common/config/env.validation.ts`. Se uma variável obrigatória estiver ausente, a aplicação **recusa iniciar** com uma mensagem de erro clara — evitando falhas silenciosas em produção.

---

# 2. Tabela de Referência Completa

| Variável | Obrigatório | Default | Ambiente | Descrição |
|---|---|---|---|---|
| `DATABASE_URL` | ✅ Sempre | — | DEV / PRD | URL completa PostgreSQL com pooler (PgBouncer). Formato: `postgresql://user:pass@host:port/db?pgbouncer=true` |
| `DIRECT_URL` | ✅ Sempre | — | DEV / PRD | URL direta PostgreSQL sem pooler. Usada por Prisma para migrations e transações interativas |
| `JWT_SECRET` | ✅ Sempre | — | DEV / PRD | Chave simétrica para assinar e verificar JWTs. **Mínimo 32 caracteres em PRD** (validado no boot) |
| `CLOUDINARY_CLOUD_NAME` | ✅ Sempre | — | DEV / PRD | Nome do cloud no Cloudinary (encontrado no Dashboard) |
| `CLOUDINARY_API_KEY` | ✅ Sempre | — | DEV / PRD | Chave pública da API Cloudinary |
| `CLOUDINARY_API_SECRET` | ✅ Sempre | — | DEV / PRD | Chave secreta da API Cloudinary. **Nunca expor no frontend** |
| `FRONTEND_URL` | ✅ em PRD | — | PRD | URL base do frontend. Usada na lista CORS e nos QR Codes dos certificados |
| `SENHA_PADRAO_USUARIO` | ✅ em PRD | `Ilbes@123` (DEV) | DEV / PRD | Senha inicial atribuída a novos funcionários criados pelo admin. Deve ser trocada no primeiro login |
| `SENHA_PADRAO_ADMIN` | ✅ (seed) | — | DEV / PRD | Senha do usuário admin criado pelo `prisma db seed`. Obrigatório para executar o seed |
| `PORT` | ❌ | `3000` | DEV / PRD | Porta HTTP do servidor. O Render injeta automaticamente |
| `NODE_ENV` | ❌ | `development` | DEV / PRD | Ambiente de execução. Valores: `development`, `test`, `production` |
| `CACHE_TTL` | ❌ | `300000` (5min) | DEV / PRD | Tempo de vida do cache em memória, em milissegundos |
| `THROTTLER_TTL` | ❌ | `60000` (1min) | DEV / PRD | Janela de tempo do rate limiting em milissegundos |
| `THROTTLER_LIMIT` | ❌ | `30` | DEV / PRD | Máximo de requisições permitidas por janela de `THROTTLER_TTL` |
| `FREQUENCIAS_PERMITIR_RETROATIVAS` | ❌ | `true` | DEV / PRD | Se `true`, professores e secretaria podem lançar frequências em datas passadas. Use `false` para restringir ao dia atual (apenas ADMIN continua podendo retroativo) |

---

# 3. Por que DATABASE_URL e DIRECT_URL são diferentes?

Em produção com Supabase, o `DATABASE_URL` aponta para o **PgBouncer** (pooler de conexões) que:
- Mantém um pool de conexões reutilizáveis — essencial para serverless/edge
- **Não suporta** prepared statements e transações interativas longas

O `DIRECT_URL` aponta para o **PostgreSQL direto** e é usado pelo Prisma para:
- `prisma migrate deploy` — migrations exigem uma sessão estável
- Transações `prisma.$transaction()` complexas

**Sem `DIRECT_URL`, migrations em produção falham com erro de protocolo.**

---

# 4. Validação de Boot (env.validation.ts)

O arquivo `src/common/config/env.validation.ts` é executado antes da inicialização do servidor:

```typescript
// Variáveis sempre obrigatórias
const VARIAVEIS_OBRIGATORIAS = [
  'DATABASE_URL', 'DIRECT_URL', 'JWT_SECRET',
  'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET',
];

// Adicionais apenas em produção
const VARIAVEIS_OBRIGATORIAS_PRODUCAO = ['FRONTEND_URL', 'SENHA_PADRAO_USUARIO'];
```

Regras adicionais em `NODE_ENV=production`:
- `JWT_SECRET` com menos de 32 caracteres → **boot bloqueado**
- `SENHA_PADRAO_USUARIO` com menos de 8 caracteres → **boot bloqueado**
- `FRONTEND_URL` deve ser uma URL válida com protocolo `http://` ou `https://`

---

# 5. Configuração por Ambiente

### Desenvolvimento Local

```env
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/braille_db"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/braille_db"
JWT_SECRET="dev-secret-nao-usar-em-producao-jamais-ok"
CLOUDINARY_CLOUD_NAME="seu_cloud"
CLOUDINARY_API_KEY="123456789"
CLOUDINARY_API_SECRET="abc123xyz"
FRONTEND_URL="http://localhost:4200"
SENHA_PADRAO_ADMIN="Admin@Dev2026!"
SENHA_PADRAO_USUARIO="Ilbes@Dev2026!"
FREQUENCIAS_PERMITIR_RETROATIVAS=true
```

### Produção (Render.com)

```env
NODE_ENV=production
DATABASE_URL="postgresql://postgres:[SENHA]@[HOST]:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:[SENHA]@[HOST]:5432/postgres"
JWT_SECRET="[STRING_ALEATORIA_64_CHARS_MINIMO]"
CLOUDINARY_CLOUD_NAME="[PROD_CLOUD]"
CLOUDINARY_API_KEY="[PROD_KEY]"
CLOUDINARY_API_SECRET="[PROD_SECRET]"
FRONTEND_URL="https://instituto-luizbraille.vercel.app"
SENHA_PADRAO_ADMIN="[SENHA_FORTE_UNICA]"
SENHA_PADRAO_USUARIO="[SENHA_FORTE_UNICA]"
FREQUENCIAS_PERMITIR_RETROATIVAS=true
```

> **Segurança**: Nunca commite o `.env` real. O arquivo `.env.example` é o template de referência e está no repositório. O `.env` real está no `.gitignore`.

---

# 6. Como Gerar um JWT_SECRET Seguro

```bash
# Linux/Mac
openssl rand -base64 64

# Node.js
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# PowerShell (Windows)
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(64))
```

---

# 7. Variáveis do Render Injetadas Automaticamente

O Render injeta automaticamente `PORT` em cada deploy. Não é necessário configurar manualmente — mas configurar explicitamente também não causa problemas.
