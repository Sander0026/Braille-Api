# Braille API

API backend do sistema do Instituto Louis Braille, desenvolvida com NestJS, Prisma e PostgreSQL.

Esta API atende os módulos administrativos do sistema, incluindo autenticação, usuários, alunos/beneficiários, turmas, frequência, comunicados, contatos, CMS do site, upload de arquivos, auditoria, atestados, laudos, apoiadores e certificados.

## Tecnologias principais

- Node.js
- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT para autenticação
- Cloudinary para armazenamento de imagens, PDFs e arquivos gerados
- Swagger para documentação da API
- ExcelJS para importação/exportação de planilhas
- PDF-lib para geração de certificados e documentos PDF

## Estrutura geral

```txt
braille-api/
├── prisma/
│   ├── schema.prisma
│   └── seed/
├── src/
│   ├── auth/
│   ├── users/
│   ├── beneficiaries/
│   ├── turmas/
│   ├── frequencias/
│   ├── comunicados/
│   ├── contatos/
│   ├── upload/
│   ├── site-config/
│   ├── audit-log/
│   ├── atestados/
│   ├── laudos/
│   ├── apoiadores/
│   ├── certificados/
│   ├── common/
│   ├── prisma/
│   ├── app.module.ts
│   └── main.ts
├── test/
├── package.json
└── README.md
```

## Pré-requisitos

- Node.js 22 ou superior recomendado
- npm
- Banco PostgreSQL disponível
- Conta Cloudinary configurada para uploads

## Variáveis de ambiente

Crie um arquivo `.env` na pasta `braille-api/` com as variáveis abaixo.

```env
# Banco de dados
DATABASE_URL="postgresql://usuario:senha@host:porta/banco?schema=public"
DIRECT_URL="postgresql://usuario:senha@host:porta/banco?schema=public"

# Autenticação
JWT_SECRET="troque-por-uma-chave-grande-e-segura"
SENHA_PADRAO_USUARIO="senha-temporaria-forte"

# Frontend autorizado no CORS
FRONTEND_URL="http://localhost:4200"

# Cloudinary
CLOUDINARY_CLOUD_NAME="seu-cloud-name"
CLOUDINARY_API_KEY="sua-api-key"
CLOUDINARY_API_SECRET="seu-api-secret"

# Cache e limitação de requisições
CACHE_TTL=300000
THROTTLER_TTL=60000
THROTTLER_LIMIT=30

# Porta da API
PORT=3000
```

> Em produção, `JWT_SECRET` e `SENHA_PADRAO_USUARIO` devem ser obrigatoriamente definidos com valores fortes.

## Instalação

```bash
npm install
```

O projeto executa `prisma generate` automaticamente no `postinstall`.

## Banco de dados

Gerar o Prisma Client manualmente, se necessário:

```bash
npx prisma generate
```

Aplicar migrações em ambiente local:

```bash
npx prisma migrate dev
```

Aplicar migrações em produção/deploy:

```bash
npx prisma migrate deploy
```

Executar seed:

```bash
npx prisma db seed
```

## Execução

Ambiente de desenvolvimento:

```bash
npm run start:dev
```

Ambiente de produção após build:

```bash
npm run start:prod
```

Por padrão, a API sobe em:

```txt
http://localhost:3000/api
```

A documentação Swagger fica em:

```txt
http://localhost:3000/docs
```

## Scripts disponíveis

```bash
npm run build          # Executa migração deploy e build NestJS
npm run build:prod     # Executa migração deploy, prisma generate e build NestJS
npm run start          # Inicia a aplicação NestJS
npm run start:dev      # Inicia em modo watch
npm run start:debug    # Inicia em modo debug
npm run start:prod     # Inicia a versão compilada em dist/
npm run lint           # Executa ESLint com correção automática
npm run format         # Formata arquivos TypeScript
npm run test           # Executa testes unitários
npm run test:e2e       # Executa testes e2e
npm run test:cov       # Executa testes com cobertura
```

## Autenticação

A autenticação usa JWT de curta duração e refresh token.

Fluxo principal:

1. `POST /api/auth/login` retorna `access_token`, `refresh_token` e dados do usuário.
2. O frontend envia o `access_token` no header `Authorization: Bearer <token>`.
3. `POST /api/auth/refresh` renova o access token usando o refresh token.
4. `POST /api/auth/logout` revoga o refresh token salvo no banco.

## Segurança aplicada

- Validação global com `ValidationPipe`.
- Remoção de campos não definidos nos DTOs com `whitelist`.
- Rejeição de campos extras com `forbidNonWhitelisted`.
- Headers HTTP protegidos com `helmet`.
- Compressão GZIP com `compression`.
- CORS restrito ao frontend local e URL configurada em ambiente.
- Rate limit global com `@nestjs/throttler`.
- Senhas com hash usando `bcrypt`.
- Refresh token salvo com hash no banco.
- Auditoria de ações críticas.
- Filtros globais para erros Prisma sem exposição de detalhes internos.

## Módulos principais

### Auth

Login, refresh token, logout, perfil do usuário logado, troca de senha e atualização de perfil.

### Users

Gestão de funcionários do sistema, geração de matrícula, geração de username, senha temporária, reset de senha, ativação, inativação e arquivamento lógico.

### Beneficiaries

Cadastro de alunos/beneficiários, importação por planilha, exportação Excel, filtros, histórico e controle de status.

### Turmas

Gestão de oficinas/turmas, professor responsável, capacidade, status, grade horária e vínculo com matrículas.

### Frequências

Registro de presença, falta, falta justificada, fechamento/reabertura de diário e vínculo com atestados.

### Comunicados

Mural de comunicados/notícias com categorias, imagem de capa, fixação e rotas públicas de leitura.

### Upload

Upload de imagens, PDFs, laudos, termos LGPD, atestados e arquivos usados pelos módulos administrativos.

### Site Config

CMS simples para configurações públicas do site, como textos, cores, logo e seções da home.

### Audit Log

Registro de ações críticas com autor, IP, user agent, entidade, ação, valores antigos e novos.

### Atestados e Laudos

Controle de documentos médicos e justificativas de ausência dos alunos.

### Apoiadores

Cadastro de voluntários, empresas, ONGs, imprensa, profissionais liberais e histórico de ações.

### Certificados

Modelos de certificados, emissão acadêmica, emissão de honraria, geração de PDF e validação pública por código.

## Rotas públicas principais

- `GET /api/comunicados`
- `GET /api/comunicados/:id`
- `GET /api/site-config`
- `GET /api/site-config/secoes`
- `GET /api/site-config/secoes/:secao`
- `GET /api/certificados/validar/:codigo`

## Rotas protegidas principais

- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PATCH /api/auth/trocar-senha`
- `PATCH /api/auth/perfil`
- `GET /api/users`
- `POST /api/users`
- `GET /api/beneficiaries`
- `POST /api/beneficiaries`
- `POST /api/beneficiaries/import`
- `GET /api/beneficiaries/export`
- `POST /api/upload`
- `POST /api/upload/pdf`
- `GET /api/modelos-certificados`
- `POST /api/modelos-certificados/emitir-academico`
- `POST /api/modelos-certificados/emitir-honraria`

## Testes

Executar testes unitários:

```bash
npm run test
```

Executar testes end-to-end:

```bash
npm run test:e2e
```

Executar cobertura:

```bash
npm run test:cov
```

## Observações de produção

- Não use valores fracos para `JWT_SECRET`.
- Configure `SENHA_PADRAO_USUARIO` em produção.
- Rode migrações com cuidado antes de subir nova versão.
- Verifique permissões de CORS pelo `FRONTEND_URL`.
- Monitore consumo do Cloudinary para uploads e certificados.
- Mantenha backup do banco PostgreSQL.

## Licença

Projeto privado/institucional. Uso restrito ao Instituto Luis Braille e equipe autorizada.
