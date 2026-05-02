# Visão Geral — Braille-Api

---

# 1. Visão Geral

## Objetivo

A **Braille-Api** é o backend do sistema de gestão institucional do **Instituto Luiz Braille**, uma organização sem fins lucrativos que atende pessoas com deficiência visual. A API centraliza toda a lógica de negócio: gestão de alunos (beneficiários), turmas de oficinas, frequências, certificados, comunicados, apoiadores, upload de documentos e o CMS do site público.

## Responsabilidade

Atua como a **única fonte da verdade** do sistema, expondo uma API REST consumida exclusivamente pelo frontend Angular. Gerencia autenticação, autorização por perfil, trilha de auditoria imutável e integração com serviços externos (Cloudinary para CDN, PostgreSQL via Supabase).

## Stack Tecnológica

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | NestJS | 11.x |
| Linguagem | TypeScript | 5.7.x |
| ORM | Prisma | 5.22.x |
| Banco de Dados | PostgreSQL | 15+ |
| Autenticação | JWT (RS256) + bcrypt | — |
| CDN / Upload | Cloudinary | 2.x |
| PDF | pdf-lib + jimp | — |
| Cache | cache-manager (in-memory) | 7.x |
| Rate Limiting | @nestjs/throttler | 6.x |
| Scheduler | @nestjs/schedule | 6.x |
| Documentação | Swagger UI | 11.x |
| Deploy | Render.com | — |

---

# 2. Arquitetura e Metodologias

## Padrões Arquiteturais Identificados

- **Modular Monolith**: cada domínio de negócio é um módulo NestJS isolado com controller, service, DTOs e entidades próprios.
- **Layered Architecture (3 camadas)**: Controller (HTTP) → Service (Regras de Negócio) → PrismaService (Persistência).
- **Dependency Injection (DI)**: NestJS IoC container injeta todas as dependências via constructor. Zero instanciação manual.
- **Repository Pattern implícito**: `PrismaService` atua como repositório universal, acessado pelos services.
- **Interceptor Pattern**: `AuditInterceptor` global intercepta todas as mutações sem modificar os controllers.
- **Filter Pattern**: `PrismaExceptionFilter` e `PrismaValidationFilter` capturam exceções Prisma globalmente.
- **Guard Pattern**: `AuthGuard` (JWT) e `RolesGuard` (RBAC) protegem rotas declarativamente.
- **SOLID**:
  - **(S) SRP**: cada módulo tem responsabilidade única; helpers isolados por domínio.
  - **(O) OCP**: novos módulos são adicionados sem modificar o AppModule core.
  - **(D) DIP**: services dependem de abstrações (interfaces de DTO) e não de implementações concretas.

## Diagrama de Camadas

```
┌─────────────────────────────────────────────────────┐
│                    HTTP Client                      │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              Infraestrutura Global                   │
│  Helmet │ CORS │ GZIP │ ThrottlerGuard              │
│  ValidationPipe │ AuditInterceptor                  │
│  PrismaExceptionFilter │ PrismaValidationFilter      │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                  Controllers                         │
│  (roteamento HTTP, extração de dados, guards)       │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                   Services                           │
│  (regras de negócio, validações, orquestração)      │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              PrismaService (@Global)                 │
│  (queries, transações, migrations)                  │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│          PostgreSQL (Supabase / Render)              │
└─────────────────────────────────────────────────────┘
```

## Diagrama de Módulos

```mermaid
graph TD
    AppModule --> AuthModule
    AppModule --> UsersModule
    AppModule --> BeneficiariesModule
    AppModule --> TurmasModule
    AppModule --> FrequenciasModule
    AppModule --> AtestadosModule
    AppModule --> LaudosModule
    AppModule --> ComunicadosModule
    AppModule --> ContatosModule
    AppModule --> DashboardModule
    AppModule --> UploadModule
    AppModule --> SiteConfigModule
    AppModule --> ApoiadoresModule
    AppModule --> CertificadosModule
    AppModule --> AuditLogModule

    AuthModule --> UploadModule
    UsersModule --> AuditLogModule
    UsersModule --> UploadModule
    BeneficiariesModule --> AuditLogModule
    BeneficiariesModule --> UploadModule
    TurmasModule --> AuditLogModule
    FrequenciasModule --> AuditLogModule
    CertificadosModule --> UploadModule
    ApoiadoresModule --> AuditLogModule

    PrismaModule -.->|@Global| AuthModule
    PrismaModule -.->|@Global| UsersModule
    PrismaModule -.->|@Global| BeneficiariesModule
    PrismaModule -.->|@Global| TurmasModule
    PrismaModule -.->|@Global| FrequenciasModule
```

---

# 3. Mapa Completo de Módulos

| Módulo | Rota Base | Responsabilidade | Nível Crítico |
|---|---|---|---|
| `auth` | `/api/auth/*` | Login, JWT, Refresh Token, Perfil | 🔴 Crítico |
| `users` | `/api/usuarios/*` | CRUD de funcionários | 🔴 Crítico |
| `beneficiaries` | `/api/beneficiaries/*` | CRUD de alunos + importação | 🔴 Crítico |
| `turmas` | `/api/turmas/*` | Oficinas, grade horária, matrículas | 🔴 Crítico |
| `frequencias` | `/api/frequencias/*` | Chamada diária, diário, fechamento | 🔴 Crítico |
| `audit-log` | `/api/audit-log/*` | Trilha imutável de auditoria | 🔴 Crítico |
| `atestados` | `/api/atestados/*` | Justificativas de falta | 🟡 Importante |
| `laudos` | `/api/laudos/*` | Laudos médicos dos alunos | 🟡 Importante |
| `certificados` | `/api/certificados/*` | Geração de PDF + QR Code | 🟡 Importante |
| `apoiadores` | `/api/apoiadores/*` | CRM de parceiros e apoiadores | 🟡 Importante |
| `comunicados` | `/api/comunicados/*` | Notícias e comunicados | 🟢 Normal |
| `contatos` | `/api/contatos/*` | Formulário público Fale Conosco | 🟢 Normal |
| `dashboard` | `/api/dashboard/*` | Métricas e KPIs | 🟢 Normal |
| `upload` | `/api/upload/*` | Upload para Cloudinary CDN | 🟡 Importante |
| `site-config` | `/api/site-config/*` | CMS do site público | 🟢 Normal |

---

# 4. Infraestrutura Global (main.ts + app.module.ts)

## Middlewares e Pipes Globais

### Helmet
```typescript
app.use(helmet());
```
Adiciona cabeçalhos HTTP de segurança: `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `X-XSS-Protection`. Esconde assinatura do Express/NestJS contra fingerprinting.

### CORS
```typescript
app.enableCors({
  origin: ['http://localhost:4200', 'https://instituto-luizbraille.vercel.app', process.env.FRONTEND_URL],
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
});
```
Whitelist explícita de origens. `process.env.FRONTEND_URL` permite configuração dinâmica por deploy sem alterar código.

### GZIP Compression
```typescript
app.use(compression());
```
Comprime todas as respostas, reduzindo ~70% do tráfego em respostas JSON grandes (listas de alunos, audit logs).

### Payload Limit
```typescript
app.use(json({ limit: '20mb' }));
app.use(urlencoded({ extended: true, limit: '20mb' }));
```
Permite upload de imagens e PDFs em base64. O padrão do Express é 100kb — sem isso, uploads falhariam silenciosamente.

### ValidationPipe Global
```typescript
new ValidationPipe({
  whitelist: true,           // Remove campos não declarados no DTO
  forbidNonWhitelisted: true,// Retorna 400 se houver campos extras
  transform: true,           // Converte strings "123" para number, etc.
})
```
Proteção contra mass assignment. Campos não declarados no DTO são automaticamente descartados **antes** de chegar ao service.

### ThrottlerGuard (Rate Limiting)
```typescript
ThrottlerModule.forRootAsync({
  ttl: 60000,   // Janela de 60 segundos
  limit: 30,    // Máximo 30 requests por janela
})
```
Bloqueia automaticamente IPs que excedam o limite. Configurável por variável de ambiente (`THROTTLER_TTL`, `THROTTLER_LIMIT`).

### AuditInterceptor (Global)
Intercepta automaticamente todas as mutações (POST, PATCH, PUT, DELETE) e registra na tabela `AuditLog`. Ver `docs/backend/06-auditoria.md`.

### PrismaExceptionFilter + PrismaValidationFilter
Capturam exceções do Prisma antes que detalhes internos do banco sejam expostos ao cliente. Ver `docs/backend/common/filters.md`.

---

# 5. Relação com Serviços Externos

| Serviço | Uso | Módulos que Utilizam |
|---|---|---|
| **Cloudinary** | CDN de imagens e PDFs | `upload`, `auth`, `users`, `beneficiaries`, `laudos`, `certificados` |
| **PostgreSQL** (Supabase/Render) | Banco de dados principal | Todos via `PrismaService` |
| **Render.com** | Plataforma de deploy do backend | Infraestrutura |

---

# 6. Prefixo Global e Swagger

- Todas as rotas estão sob `/api/*` (`app.setGlobalPrefix('api')`)
- Swagger disponível em `/docs` — **somente em desenvolvimento** (não exposto em produção)
- Autenticação no Swagger: Bearer Token (configurado via `addBearerAuth()`)

---

# 7. Variáveis de Ambiente Críticas

Ver documentação completa em `docs/backend/10-variaveis-ambiente.md`.

Resumo das obrigatórias:
- `DATABASE_URL` — URL de conexão PostgreSQL com pooler
- `DIRECT_URL` — URL direta PostgreSQL (para migrations)
- `JWT_SECRET` — Segredo de assinatura JWT (mínimo 32 chars em PRD)
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

---

# 8. Resumo Técnico Final

A Braille-Api é um **monolito modular bem estruturado** seguindo os padrões estabelecidos pelo ecossistema NestJS. A separação por módulos garante que cada domínio de negócio seja independente, testável e manutenível. A infraestrutura global (guards, interceptors, filters, pipes) elimina boilerplate repetitivo dos controllers e garante consistência de segurança em toda a aplicação sem intervenção manual por rota.

**Criticidade geral:** Alta — é o único backend do sistema institucional.  
**Complexidade:** Média-Alta — 15 módulos de negócio, sistema de auth sofisticado, geração de PDF.  
**Risco principal:** Ausência de monitoramento em produção (sem Sentry/Datadog configurado no backend).
