# Setup Local — Braille-Api

---

# 1. Pré-requisitos

Certifique-se de ter instalado:

| Ferramenta | Versão mínima | Verificação |
|---|---|---|
| Node.js | 22.x LTS | `node --version` |
| npm | 10.x | `npm --version` |
| PostgreSQL | 15+ | `psql --version` |
| Git | qualquer | `git --version` |
| Conta Cloudinary | Free Tier | [cloudinary.com](https://cloudinary.com) |

> **Supabase como alternativa ao PostgreSQL local:** você pode usar um projeto gratuito no [supabase.com](https://supabase.com) em vez de instalar o PostgreSQL localmente. Nesse caso, as variáveis `DATABASE_URL` e `DIRECT_URL` virão diretamente do painel do Supabase.

---

# 2. Clone e Instalação

```bash
# 1. Clone o repositório
git clone <URL_DO_REPOSITORIO>
cd PI-5/Braille-Api

# 2. Instale as dependências
npm install
# O postinstall executa automaticamente `npx prisma generate`
```

---

# 3. Configuração do Ambiente

```bash
# 3. Copie o arquivo de exemplo
cp .env.example .env
```

Edite o `.env` e preencha **todas** as variáveis obrigatórias:

```env
# Banco de dados
DATABASE_URL="postgresql://usuario:senha@localhost:5432/braille_db"
DIRECT_URL="postgresql://usuario:senha@localhost:5432/braille_db"

# JWT
JWT_SECRET="umSegredoMuitoForteComMaisDe32Caracteres"

# Cloudinary (obtenha em cloudinary.com > Dashboard)
CLOUDINARY_CLOUD_NAME="seu_cloud_name"
CLOUDINARY_API_KEY="seu_api_key"
CLOUDINARY_API_SECRET="seu_api_secret"

# Senha padrão do admin (usada apenas no seed)
SENHA_PADRAO_ADMIN="SENHADEADMIN@2026!"

# Senha padrão de novos usuários funcionários
SENHA_PADRAO_USUARIO="SENHADEUSUARIOs@2026!"

# URL do frontend
FRONTEND_URL="http://localhost:4200"
```

> Consulte a referência completa de variáveis em `docs/backend/10-variaveis-ambiente.md`.

---

# 4. Banco de Dados

### 4a. Criar banco (PostgreSQL local)

```sql
-- Execute no psql ou em qualquer cliente SQL
CREATE DATABASE braille_db;
```

### 4b. Executar migrations

```bash
# Aplica todas as migrations ao banco configurado em DATABASE_URL
npm run db:migrate:dev
```

### 4c. Popular com dados iniciais (seed)

```bash
# Cria o usuário admin + configurações padrão do site
npm run db:seed
```

O seed cria:
- **Usuário admin**: username `admin`, senha = `SENHA_PADRAO_ADMIN` (com `precisaTrocarSenha: true`)
- **Configurações padrão do site** (`SiteConfig`)

> **Idempotência**: o seed pode ser executado múltiplas vezes sem duplicar dados.

---

# 5. Iniciar o Servidor

```bash
# Desenvolvimento (hot-reload ativo)
npm run start:dev

# Produção local (compilado)
npm run build
npm run start:prod
```

**Verificações após iniciar:**
- API: [http://localhost:3000/api](http://localhost:3000/api) → deve retornar `{ "status": "ok" }`
- Swagger: [http://localhost:3000/docs](http://localhost:3000/docs) → documentação interativa

---

# 6. Scripts Disponíveis

| Script | Comando | Descrição |
|---|---|---|
| Desenvolvimento | `npm run start:dev` | Servidor com hot-reload |
| Debug | `npm run start:debug` | Hot-reload + debugger Node |
| Build | `npm run build` | Compila TypeScript → `dist/` |
| Produção | `npm run start:prod` | Executa `dist/main.js` |
| Testes | `npm run test` | Testes unitários (Jest) |
| Testes watch | `npm run test:watch` | Modo watch |
| Cobertura | `npm run test:cov` | Gera relatório de cobertura |
| E2E | `npm run test:e2e` | Testes end-to-end |
| Lint | `npm run lint` | ESLint + auto-fix |
| Format | `npm run format` | Prettier |
| Migrate DEV | `npm run db:migrate:dev` | Nova migration em dev |
| Migrate PRD | `npm run db:migrate:deploy` | Aplica migrations em produção |
| Seed | `npm run db:seed` | Popula dados iniciais |
| Studio | `npm run db:studio` | Abre Prisma Studio (GUI do banco) |
| ERD | `npm run db:generate` | Gera diagrama ER (`.svg`) |

---

# 7. Prisma Studio (GUI do Banco)

```bash
npm run db:studio
```

Abre interface gráfica em [http://localhost:5555](http://localhost:5555) para visualizar e editar dados diretamente. Útil para debugging.

---

# 8. Troubleshooting

### Erro: `SENHA_PADRAO_ADMIN não está definida`
**Causa:** O seed foi executado sem configurar a variável de ambiente.  
**Solução:** Defina `SENHA_PADRAO_ADMIN` no `.env` e execute novamente.

### Erro: `P1001: Can't reach database server`
**Causa:** PostgreSQL não está rodando ou `DATABASE_URL` está incorreta.  
**Solução:** Verifique se o PostgreSQL está ativo e se a connection string está correta (host, porta, usuário, senha, nome do banco).

### Erro: `P3009: migrate found failed migrations`
**Causa:** Uma migration anterior falhou parcialmente.  
**Solução:** Execute `npx prisma migrate resolve --rolled-back <nome_da_migration>` e tente novamente.

### Erro: `Cloudinary upload failed`
**Causa:** Credenciais inválidas ou ausentes.  
**Solução:** Verifique `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` e `CLOUDINARY_API_SECRET` no painel do Cloudinary.

### Erro: `JWT_SECRET deve ter pelo menos 32 caracteres`
**Causa:** O `env.validation.ts` bloqueia o boot em produção se o secret for curto.  
**Solução:** Use uma string aleatória longa: `openssl rand -base64 48`.

### Porta 3000 já em uso
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

---

# 9. Deploy em Produção (Render.com)

1. Conecte o repositório ao Render (New Web Service)
2. Configure as variáveis de ambiente no painel do Render (mesmas do `.env`, com valores de produção)
3. Build Command: `npm run build:prod` (executa `prisma generate && nest build`)
4. Start Command: `npm run start:prod`
5. As migrations são aplicadas automaticamente via `db:migrate:deploy` — configure como um **pre-deploy hook** ou execute manualmente após o primeiro deploy

> **Importante:** `DIRECT_URL` é necessário no Render pois o `DATABASE_URL` usa o pooler do Supabase (PgBouncer), que não suporta migrations. As migrations devem sempre usar a URL direta.
