# 02 — Configuração de Ambiente e Scripts

---

## 1. Objetivo

Este documento descreve as configurações não sigilosas necessárias para rodar, desenvolver, testar, migrar e publicar a Braille API.

Nenhum valor real de segredo deve ser versionado. Use este arquivo apenas como guia de referência.

---

## 2. Bootstrap da Aplicação

Arquivo: `src/main.ts`.

A aplicação é inicializada por `bootstrap()`, que executa:

1. `NestFactory.create(AppModule)`.
2. Configuração de payload JSON e URL encoded com limite de `20mb`.
3. Ativação de `helmet()` para headers de segurança.
4. Ativação de `compression()` para GZIP.
5. Prefixo global `/api`.
6. CORS com origens permitidas.
7. `ValidationPipe` global.
8. Swagger via `setupSwagger(app)`.
9. `listen(process.env.PORT || 3000)`.

### Por que foi escolhido assim?

- O limite maior de payload existe porque a API manipula imagens, PDFs, laudos e documentos.
- Helmet reduz exposição de headers e vetores comuns de ataque.
- Compressão melhora performance em respostas maiores.
- Prefixo `/api` separa backend de frontend e documentação.
- ValidationPipe evita que payloads inválidos cheguem aos services.

---

## 3. Configuração Global no AppModule

Arquivo: `src/app.module.ts`.

O `AppModule` configura:

| Recurso | Objetivo |
|---|---|
| `ConfigModule.forRoot` | Carregar `.env` e validar variáveis. |
| `CacheModule.registerAsync` | Cache global com TTL configurável. |
| `ThrottlerModule.forRootAsync` | Rate limit global. |
| `ScheduleModule.forRoot` | Habilitar cron/jobs. |
| `APP_GUARD` com `ThrottlerGuard` | Proteção global contra abuso. |
| `APP_INTERCEPTOR` com `AuditInterceptor` | Auditoria global de mutações. |
| `APP_FILTER` com Prisma filters | Tratamento seguro de erros do banco. |

---

## 4. Variáveis de Ambiente

Arquivo de validação: `src/common/config/env.validation.ts`.

### 4.1 Variáveis obrigatórias

| Variável | Obrigatória | Ambiente | Finalidade |
|---|---:|---|---|
| `DATABASE_URL` | Sim | Todos | URL principal do banco PostgreSQL usada pelo Prisma Client. |
| `DIRECT_URL` | Sim | Todos | URL direta usada pelo Prisma em migrations e conexões diretas. |
| `JWT_SECRET` | Sim | Todos | Segredo usado para assinar/verificar JWT. |
| `CLOUDINARY_CLOUD_NAME` | Sim | Todos | Nome da cloud no Cloudinary. |
| `CLOUDINARY_API_KEY` | Sim | Todos | Chave pública da API Cloudinary. |
| `CLOUDINARY_API_SECRET` | Sim | Todos | Segredo da API Cloudinary. |

### 4.2 Obrigatórias em produção

| Variável | Finalidade |
|---|---|
| `FRONTEND_URL` | URL oficial do frontend liberada no CORS. |
| `SENHA_PADRAO_USUARIO` | Senha temporária inicial de novos funcionários. |

### 4.3 Variáveis opcionais com default

| Variável | Default | Finalidade |
|---|---:|---|
| `NODE_ENV` | `development` | Ambiente de execução. Valores aceitos: `development`, `test`, `production`. |
| `PORT` | `3000` | Porta HTTP da API. |
| `CACHE_TTL` | `300000` | TTL global de cache em milissegundos. |
| `THROTTLER_TTL` | `60000` | Janela do rate limit em milissegundos. |
| `THROTTLER_LIMIT` | `30` | Número máximo de requisições por janela. |
| `FREQUENCIAS_PERMITIR_RETROATIVAS` | `true` | Controla lançamento retroativo de frequências. |

---

## 5. Exemplo Seguro de `.env.example`

```env
NODE_ENV=development
PORT=3000

DATABASE_URL=postgresql://usuario:senha@host:5432/database
DIRECT_URL=postgresql://usuario:senha@host:5432/database

JWT_SECRET=troque-por-um-segredo-forte-com-mais-de-32-caracteres

FRONTEND_URL=http://localhost:4200
SENHA_PADRAO_USUARIO=troque-esta-senha

CLOUDINARY_CLOUD_NAME=nome-da-cloud
CLOUDINARY_API_KEY=api-key
CLOUDINARY_API_SECRET=api-secret

CACHE_TTL=300000
THROTTLER_TTL=60000
THROTTLER_LIMIT=30
FREQUENCIAS_PERMITIR_RETROATIVAS=true
```

Nunca use estes valores em produção sem substituição.

---

## 6. Scripts NPM

Os scripts principais estão no `package.json`.

| Script | Função | Quando usar |
|---|---|---|
| `postinstall` | Executa `npx prisma generate` | Após instalar dependências. |
| `build` | Executa `nest build` | Build local. |
| `build:prod` | `prisma generate && nest build` | Build de produção. |
| `db:generate` | `prisma generate` | Regenerar Prisma Client. |
| `db:migrate:dev` | `prisma migrate dev` | Criar/aplicar migration em desenvolvimento. |
| `db:migrate:deploy` | `prisma migrate deploy` | Aplicar migrations em produção/deploy. |
| `db:studio` | `prisma studio` | Abrir interface Prisma Studio. |
| `db:seed` | `prisma db seed` | Popular banco inicial. |
| `format` | Prettier em `src` e `test` | Padronizar código. |
| `start` | `nest start` | Rodar aplicação. |
| `start:dev` | `nest start --watch` | Desenvolvimento com hot reload. |
| `start:debug` | Debug com watch | Depuração. |
| `start:prod` | `node dist/main` | Rodar build compilado. |
| `lint` | ESLint com fix | Corrigir estilo. |
| `test` | Jest | Testes unitários. |
| `test:watch` | Jest watch | Desenvolvimento de testes. |
| `test:cov` | Cobertura | Medir cobertura. |
| `test:e2e` | Jest e2e | Testes ponta a ponta. |

---

## 7. Fluxo Recomendado para Rodar Localmente

```bash
npm install
npm run db:generate
npm run db:migrate:dev
npm run db:seed
npm run start:dev
```

Depois, acessar:

```txt
API:     http://localhost:3000/api
Swagger: http://localhost:3000/docs
```

---

## 8. Fluxo Recomendado para Deploy

```bash
npm ci
npm run build:prod
npm run db:migrate:deploy
npm run start:prod
```

Em plataformas como Render, Railway, Fly.io, VPS ou similares, recomenda-se separar:

1. instalação;
2. geração Prisma;
3. build;
4. migration deploy;
5. start.

---

## 9. Cuidados Operacionais

- Nunca versionar `.env` real.
- Nunca expor `JWT_SECRET`.
- Nunca usar senha padrão fraca em produção.
- Em produção, `JWT_SECRET` deve ter pelo menos 32 caracteres.
- `FRONTEND_URL` deve apontar para o domínio oficial.
- `DATABASE_URL` e `DIRECT_URL` devem ser protegidas no painel da plataforma.
- Migrations devem ser revisadas antes de produção.
- Seeds não devem sobrescrever dados reais.

---

## 10. Checklist de Ambiente

```txt
[ ] DATABASE_URL configurado
[ ] DIRECT_URL configurado
[ ] JWT_SECRET forte configurado
[ ] CLOUDINARY_CLOUD_NAME configurado
[ ] CLOUDINARY_API_KEY configurado
[ ] CLOUDINARY_API_SECRET configurado
[ ] FRONTEND_URL configurado em produção
[ ] SENHA_PADRAO_USUARIO configurada em produção
[ ] Migrations aplicadas
[ ] Prisma Client gerado
[ ] Swagger validado
[ ] CORS validado com o frontend
```
