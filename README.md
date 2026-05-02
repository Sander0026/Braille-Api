# README — Braille-Api

![NestJS](https://img.shields.io/badge/NestJS-11.x-E0234E?logo=nestjs&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5.x-2D3748?logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791?logo=postgresql&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)
![Deploy](https://img.shields.io/badge/Deploy-Render.com-46E3B7?logo=render)

API REST do sistema de gestão institucional do **Instituto Luiz Braille** — plataforma para gestão de alunos com deficiência visual, turmas de oficinas, frequências, certificados, apoiadores e CMS do site público.

---

## Pré-requisitos

| Ferramenta | Versão | Verificação |
|---|---|---|
| Node.js | 22.x LTS | `node --version` |
| npm | 10.x | `npm --version` |
| PostgreSQL | 15+ | `psql --version` (ou usar Supabase) |

---

## Setup Rápido (5 passos)

```bash
# 1. Clone e instale
git clone <URL_REPOSITORIO>
cd Braille-Api
npm install

# 2. Configure o ambiente
cp .env.example .env
# → Edite o .env com suas credenciais (banco, JWT, Cloudinary)

# 3. Crie o banco (PostgreSQL local)
psql -U postgres -c "CREATE DATABASE braille_db;"

# 4. Execute migrations e seed
npm run db:migrate:dev
npm run db:seed

# 5. Inicie o servidor
npm run start:dev
```

**Verifique:**
- API: [http://localhost:3000/api](http://localhost:3000/api)
- Swagger: [http://localhost:3000/docs](http://localhost:3000/docs)
- Login: `username: admin` / `senha: SENHA_PADRAO_ADMIN` (do `.env`)

> Documentação completa de setup em [`docs/backend/01-setup.md`](docs/backend/01-setup.md)

---

## Variáveis de Ambiente Obrigatórias

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | URL PostgreSQL com pooler (PgBouncer) |
| `DIRECT_URL` | URL PostgreSQL direta (para migrations) |
| `JWT_SECRET` | Segredo JWT (mínimo 32 chars em produção) |
| `CLOUDINARY_CLOUD_NAME` | Nome do cloud no Cloudinary |
| `CLOUDINARY_API_KEY` | Chave pública Cloudinary |
| `CLOUDINARY_API_SECRET` | Chave secreta Cloudinary |
| `SENHA_PADRAO_ADMIN` | Senha do admin criado pelo seed |

> Referência completa em [`docs/backend/10-variaveis-ambiente.md`](docs/backend/10-variaveis-ambiente.md)

---

## Scripts Disponíveis

| Script | Descrição |
|---|---|
| `npm run start:dev` | Servidor com hot-reload |
| `npm run build` | Compila TypeScript para `dist/` |
| `npm run start:prod` | Executa build de produção |
| `npm run test` | Testes unitários (Jest) |
| `npm run test:cov` | Cobertura de testes |
| `npm run lint` | ESLint + auto-fix |
| `npm run db:migrate:dev` | Nova migration em dev |
| `npm run db:migrate:deploy` | Aplica migrations em produção |
| `npm run db:seed` | Popula dados iniciais |
| `npm run db:studio` | Prisma Studio (GUI do banco) |

---

## Arquitetura

```
Controller (HTTP) → Service (Regras de Negócio) → PrismaService → PostgreSQL
         ↑                      ↑
   Guards (Auth/Roles)    AuditLogService
   Interceptors (Audit)
   Filters (Prisma)
```

### Módulos de Negócio

| Módulo | Rota | Descrição |
|---|---|---|
| `auth` | `/api/auth/*` | Login, JWT, Refresh Token, Perfil |
| `users` | `/api/usuarios/*` | CRUD de funcionários |
| `beneficiaries` | `/api/beneficiaries/*` | CRUD de alunos + importação Excel |
| `turmas` | `/api/turmas/*` | Oficinas, grade horária, matrículas |
| `frequencias` | `/api/frequencias/*` | Chamada, diário, fechamento |
| `certificados` | `/api/certificados/*` | Geração de PDF + QR Code |
| `apoiadores` | `/api/apoiadores/*` | CRM de parceiros |
| `upload` | `/api/upload/*` | Upload Cloudinary CDN |
| `audit-log` | `/api/audit-log/*` | Trilha de auditoria imutável |
| `site-config` | `/api/site-config/*` | CMS do site público |
| + 5 módulos | ... | comunicados, contatos, laudos, atestados, dashboard |

---

## Documentação Técnica

Toda a documentação está em `docs/backend/`:

| Documento | Conteúdo |
|---|---|
| [`00-visao-geral.md`](docs/backend/00-visao-geral.md) | Arquitetura, stack, diagrama de módulos |
| [`01-setup.md`](docs/backend/01-setup.md) | Setup local completo + troubleshooting |
| [`02-banco-de-dados.md`](docs/backend/02-banco-de-dados.md) | Schema Prisma, modelos, decisões de design |
| [`03-autenticacao.md`](docs/backend/03-autenticacao.md) | JWT, Refresh Token, Guards |
| [`05-seguranca.md`](docs/backend/05-seguranca.md) | Medidas de segurança implementadas |
| [`06-auditoria.md`](docs/backend/06-auditoria.md) | AuditInterceptor, AuditLog |
| [`09-testes.md`](docs/backend/09-testes.md) | Estratégia e execução de testes |
| [`10-variaveis-ambiente.md`](docs/backend/10-variaveis-ambiente.md) | Referência completa de env vars |
| [`11-decisoes-tecnicas.md`](docs/backend/11-decisoes-tecnicas.md) | ADRs — "por quê" de cada decisão |
| [`modulos/`](docs/backend/modulos/) | Documentação individual por módulo |

---

## Endpoints (Swagger)

Disponível apenas em desenvolvimento: [http://localhost:3000/docs](http://localhost:3000/docs)

Autenticação via Bearer Token. Primeiro, realize login em `POST /api/auth/login` e use o `access_token` retornado.

---

## Testes

```bash
npm run test        # Todos os testes unitários
npm run test:watch  # Modo watch
npm run test:cov    # Relatório de cobertura HTML
npm run test:e2e    # Testes end-to-end
```

---

## Deploy (Render.com)

1. Conectar repositório ao Render (New Web Service)
2. Configurar variáveis de ambiente no painel
3. **Build Command:** `npm run build:prod`
4. **Start Command:** `npm run start:prod`
5. Rodar migrations: `npm run db:migrate:deploy` (pre-deploy hook)

> Detalhe completo em [`docs/backend/01-setup.md#deploy`](docs/backend/01-setup.md)

---

## Contribuindo

Leia [`CONTRIBUTING.md`](CONTRIBUTING.md) antes de abrir um PR.

**Checklist rápido:**
- [ ] `npm run lint` sem erros
- [ ] Testes passando (`npm run test`)
- [ ] Novo módulo adicionado ao `ENTIDADE_MAP` no audit interceptor
- [ ] DTOs com validators (`class-validator`)
- [ ] Nenhum campo sensível retornado sem select cirúrgico

---

## Segurança

Reporte vulnerabilidades conforme [`SECURITY.md`](SECURITY.md).

---

## Licença

Uso restrito — Instituto Luiz Braille. Não destinado à distribuição pública.