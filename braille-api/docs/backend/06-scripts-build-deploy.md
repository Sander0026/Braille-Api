# 06 — Scripts, Build, Deploy e Operação (`package.json`)

---

# 1. Visão Geral

## Objetivo

Este documento descreve o arquivo `package.json` da Braille API, com foco nos scripts de desenvolvimento, build, execução, Prisma, migrations, seed, testes, lint, formatação e fluxo recomendado de deploy.

O `package.json` é o manifesto operacional do projeto Node.js/NestJS. Ele define os comandos usados por desenvolvedores, CI/CD, ambiente local e produção.

## Responsabilidade

O `package.json` é responsável por:

- declarar metadados do projeto;
- definir scripts npm;
- declarar dependências runtime;
- declarar dependências de desenvolvimento;
- configurar Jest;
- configurar seed do Prisma;
- padronizar comandos de build, migrations e execução.

## Fluxo de Funcionamento

Fluxo operacional recomendado:

```txt
Instalação
  ↓
npm install
  ↓
postinstall: npx prisma generate
  ↓
Aplicar migrations em ambiente real
  ↓
npm run db:migrate:deploy
  ↓
Garantir Prisma Client atualizado
  ↓
npm run db:generate
  ↓
Build de produção
  ↓
npm run build
  ↓
Execução
  ↓
npm run start:prod
```

---

# 2. Arquitetura e Metodologias

## Padrões Arquiteturais Identificados

- **Script-driven Operations**: operações padronizadas por scripts npm.
- **Build/Deploy Separation**: build separado da execução de migrations.
- **Prisma Migration Workflow**: migrations controladas por comandos específicos.
- **Developer Experience Pattern**: scripts para watch mode, debug, lint, format e testes.
- **Environment-aware Deployment**: deploy deve aplicar migrations antes de executar produção.
- **Postinstall Generation Pattern**: Prisma Client gerado após instalação.

## Justificativa Técnica

Separar build e migrations é uma decisão profissional importante.

O build deve apenas compilar a aplicação. Migrations alteram banco de dados e devem ser executadas em etapa controlada, com responsabilidade operacional clara.

Essa separação evita:

- alteração acidental do banco durante build;
- falhas de deploy por migração inesperada;
- reset de banco indevido;
- comportamento imprevisível em ambientes de CI/CD;
- acoplamento entre compilação de código e evolução de schema.

O script `build:prod` ainda executa `prisma generate && nest build`, mas não executa migration. Isso é adequado, pois gerar Prisma Client é seguro e necessário para tipagem runtime.

---

# 3. Fluxo Interno do Código

## Fluxo de Execução dos Scripts

### 1. `postinstall`

```json
"postinstall": "npx prisma generate"
```

Executado automaticamente após `npm install`.

Objetivo:

- gerar Prisma Client;
- garantir que `@prisma/client` reflita o `schema.prisma` atual.

Impacto:

- melhora compatibilidade após instalação;
- reduz erro comum de Prisma Client desatualizado.

### 2. `build`

```json
"build": "nest build"
```

Compila a aplicação NestJS para a pasta `dist`.

Responsabilidade:

- transpilar TypeScript;
- gerar artefatos executáveis em JavaScript;
- não executar migrations.

### 3. `build:prod`

```json
"build:prod": "prisma generate && nest build"
```

Gera Prisma Client e compila o projeto.

Uso recomendado:

- builds de produção;
- CI/CD;
- ambientes onde Prisma Client precisa ser garantido antes da compilação.

### 4. `db:generate`

```json
"db:generate": "prisma generate"
```

Gera manualmente o Prisma Client.

Quando usar:

- após alterar `schema.prisma`;
- após aplicar migrations;
- após instalar dependências;
- antes de build se houver dúvida sobre client desatualizado.

### 5. `db:migrate:dev`

```json
"db:migrate:dev": "prisma migrate dev"
```

Cria e aplica migrations em ambiente de desenvolvimento.

Uso:

- desenvolvimento local;
- criação de nova migration;
- validação inicial de mudanças no schema.

Atenção:

- não deve ser usado em produção;
- pode executar fluxos interativos;
- pode detectar drift e solicitar ações destrutivas.

### 6. `db:migrate:deploy`

```json
"db:migrate:deploy": "prisma migrate deploy"
```

Aplica migrations já existentes em ambientes de produção/homologação.

Uso recomendado:

- deploy;
- CI/CD;
- servidores de produção.

Benefício:

- não cria novas migrations;
- apenas aplica migrations pendentes;
- fluxo previsível e seguro para produção.

### 7. `db:studio`

```json
"db:studio": "prisma studio"
```

Abre interface visual do Prisma Studio para inspecionar dados.

Uso:

- desenvolvimento;
- debug;
- validação manual de registros.

Atenção:

- não deve ser exposto em produção.

### 8. `db:seed`

```json
"db:seed": "prisma db seed"
```

Executa seed configurado em:

```json
"prisma": {
  "seed": "ts-node prisma/seed/index.ts"
}
```

Objetivo:

- popular dados iniciais;
- criar dados mínimos para desenvolvimento/teste;
- inicializar configurações ou usuários se o seed estiver implementado.

### 9. `format`

```json
"format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\""
```

Formata arquivos TypeScript do `src` e `test`.

### 10. `start`

```json
"start": "nest start"
```

Inicia aplicação em modo padrão via Nest CLI.

### 11. `start:dev`

```json
"start:dev": "nest start --watch"
```

Inicia aplicação em modo desenvolvimento com watch.

### 12. `start:debug`

```json
"start:debug": "nest start --debug --watch"
```

Inicia com debugger habilitado e watch mode.

### 13. `start:prod`

```json
"start:prod": "node dist/main"
```

Executa artefato compilado.

Pré-requisito:

```bash
npm run build
```

ou:

```bash
npm run build:prod
```

### 14. `lint`

```json
"lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix"
```

Executa ESLint com correção automática.

Atenção:

- `--fix` altera arquivos;
- em CI, pode ser interessante ter script separado sem `--fix`.

### 15. Testes

Scripts:

```json
"test": "jest"
"test:watch": "jest --watch"
"test:cov": "jest --coverage"
"test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand"
"test:e2e": "jest --config ./test/jest-e2e.json"
```

Objetivo:

- executar testes unitários;
- executar testes em watch;
- gerar cobertura;
- depurar testes;
- executar testes e2e.

## Dependências Internas

| Dependência | Uso |
|---|---|
| `src/` | Código TypeScript compilado por `nest build` |
| `test/` | Testes e2e/unitários |
| `prisma/schema.prisma` | Base para `prisma generate` e migrations |
| `prisma/migrations/` | Histórico aplicado por `migrate deploy` |
| `prisma/seed/index.ts` | Seed configurado |
| `dist/main` | Artefato executado por `start:prod` |

## Dependências Externas

O projeto depende de bibliotecas runtime e dev.

Principais grupos:

- NestJS;
- Prisma;
- autenticação e criptografia;
- validação;
- upload/documentos;
- Swagger;
- testes;
- lint/format;
- TypeScript.

---

# 4. Dicionário Técnico

## Variáveis

O `package.json` não declara variáveis de ambiente diretamente, mas seus scripts dependem de variáveis usadas por Prisma e pela API.

| Variável | Script afetado | Objetivo |
|---|---|---|
| `DATABASE_URL` | `db:*`, `start:*`, `build:prod` indiretamente | Conexão Prisma/PostgreSQL |
| `DIRECT_URL` | `db:migrate:*` | Conexão direta para migrations |
| `NODE_ENV` | `start:prod`, runtime | Define ambiente operacional |
| `JWT_SECRET` | runtime | Autenticação JWT |
| `CLOUDINARY_*` | runtime | Uploads e documentos |

## Funções e Métodos

Não há funções TypeScript no `package.json`. Os comandos relevantes são scripts npm.

| Script | Objetivo | Quando usar |
|---|---|---|
| `postinstall` | Gerar Prisma Client após instalação | Automático |
| `build` | Compilar NestJS | Build local/produção |
| `build:prod` | Gerar Prisma Client e compilar | CI/CD ou produção |
| `db:generate` | Gerar Prisma Client | Após mudar schema |
| `db:migrate:dev` | Criar/aplicar migrations dev | Desenvolvimento |
| `db:migrate:deploy` | Aplicar migrations existentes | Produção/homologação |
| `db:studio` | Abrir Prisma Studio | Desenvolvimento/debug |
| `db:seed` | Executar seed | Setup de dados |
| `format` | Formatar código | Antes de commit |
| `start` | Rodar via Nest CLI | Execução comum |
| `start:dev` | Rodar com watch | Desenvolvimento |
| `start:debug` | Rodar com debug | Debug |
| `start:prod` | Rodar build compilado | Produção |
| `lint` | ESLint com autofix | Qualidade |
| `test` | Testes unitários | Validação |
| `test:e2e` | Testes ponta a ponta | Validação integrada |

## Classes

O `package.json` não define classes.

## Interfaces e Tipagens

Configuração Jest define comportamento para TypeScript:

```json
"transform": {
  "^.+\\.(t|j)s$": "ts-jest"
}
```

Isso permite executar testes escritos em TypeScript.

---

# 5. Serviços e Integrações

## APIs

O `package.json` não expõe endpoints diretamente, mas seus scripts controlam como a API é compilada e executada.

## Banco de Dados

Scripts Prisma:

| Script | Relação com banco |
|---|---|
| `db:generate` | Gera client a partir do schema |
| `db:migrate:dev` | Cria e aplica migrations em desenvolvimento |
| `db:migrate:deploy` | Aplica migrations pendentes em produção |
| `db:studio` | Inspeciona banco visualmente |
| `db:seed` | Popula dados iniciais |

## Serviços Externos

Dependências runtime indicam integrações com:

| Dependência | Serviço/Função |
|---|---|
| `cloudinary` | Upload e armazenamento externo |
| `@prisma/client` | Banco PostgreSQL |
| `exceljs` | Planilhas `.xlsx` |
| `pdf-lib` | Geração de PDFs |
| `qrcode` | QR Codes de certificados |
| `dompurify` + `jsdom` | Sanitização HTML |
| `bcrypt` | Hash de senhas e refresh secrets |
| `@nestjs/jwt` | JWT |

---

# 6. Segurança e Qualidade

## Segurança

Pontos relevantes:

- `bcrypt` usado para senhas e secrets de refresh token;
- `@nestjs/jwt` usado para autenticação;
- `helmet` usado para headers HTTP;
- `class-validator` e `class-transformer` usados para validação de DTOs;
- `dompurify` e `jsdom` usados para sanitização de HTML;
- `@nestjs/throttler` usado para rate limiting;
- migrations separadas do build reduzem risco operacional.

## Qualidade

Ferramentas de qualidade:

- TypeScript;
- ESLint;
- Prettier;
- Jest;
- ts-jest;
- Supertest;
- NestJS Testing;
- scripts padronizados.

A configuração Jest usa:

```json
"rootDir": "src",
"testRegex": ".*\\.spec\\.ts$",
"testEnvironment": "node"
```

Isso indica foco em testes unitários dentro de `src`.

## Performance

Dependências e scripts relacionados à performance:

- `compression` para compressão HTTP;
- `cache-manager` e `@nestjs/cache-manager` para cache;
- `@nestjs/throttler` para controle de abuso;
- `jimp`, `pdf-lib`, `exceljs` e `cloudinary` podem impactar CPU/memória em rotas documentais.

---

# 7. Regras de Negócio

Embora `package.json` seja operacional, ele sustenta regras técnicas importantes:

- build não deve aplicar migration automaticamente;
- produção deve usar `db:migrate:deploy`, não `db:migrate:dev`;
- Prisma Client deve ser gerado após instalação e após mudança no schema;
- execução de produção deve usar `dist/main`;
- testes devem ser executados com Jest;
- seed deve passar por `prisma db seed`;
- lint atual corrige arquivos automaticamente.

---

# 8. Pontos de Atenção

## Riscos

- `postinstall` executa `npx prisma generate`; em alguns ambientes de build sem variáveis Prisma corretas, isso pode causar falhas dependendo da configuração.
- `lint` usa `--fix`, o que altera arquivos automaticamente; para CI, é melhor ter script separado somente de verificação.
- `build:prod` executa `prisma generate`, mas não migrations; isso está correto, mas exige que deploy rode `db:migrate:deploy` explicitamente.
- `db:migrate:dev` não deve ser usado em produção.
- `db:studio` não deve ficar acessível em produção.

## Débitos Técnicos

- Criar script `lint:check` sem `--fix`.
- Criar script `format:check` para CI.
- Criar script operacional composto, por exemplo `deploy:prepare`, se o ambiente exigir.
- Documentar pipeline real de deploy da plataforma utilizada.
- Revisar se `@types/xlsx` ainda é necessário, já que o projeto usa `exceljs`.

## Melhorias Futuras

Sugestão de scripts adicionais:

```json
{
  "lint:check": "eslint \"{src,apps,libs,test}/**/*.ts\"",
  "format:check": "prettier --check \"src/**/*.ts\" \"test/**/*.ts\"",
  "ci:test": "npm run lint:check && npm run test && npm run build"
}
```

---

# 9. Relação com Outros Módulos

| Módulo/Área | Relação |
|---|---|
| Prisma | Scripts `db:*`, `postinstall`, `build:prod` |
| AppModule | Build compila todos os módulos importados |
| Auth | Depende de `bcrypt` e `@nestjs/jwt` |
| Upload | Depende de `cloudinary`, `streamifier`, `multer` types |
| Certificados | Depende de `pdf-lib`, `fontkit`, `qrcode`, `jimp` |
| Beneficiaries | Depende de `exceljs` para importação/exportação |
| Common | Depende de `dompurify`, `jsdom`, validators e filtros |
| Testes | Dependem de Jest, Supertest e Nest Testing |
| Deploy | Depende de `build`, `db:migrate:deploy`, `start:prod` |

---

# 10. Resumo Técnico Final

O `package.json` da Braille API está bem organizado para desenvolvimento e operação. A separação entre `build`, `db:migrate:deploy` e `db:generate` representa uma evolução importante para segurança de deploy.

## Função do módulo

Definir scripts, dependências, testes e configuração operacional do projeto.

## Importância no sistema

Alta. Scripts incorretos podem quebrar build, deploy, migrations ou execução em produção.

## Nível de criticidade

Alto para operação e CI/CD.

## Complexidade

Média. O arquivo reúne múltiplas responsabilidades operacionais, mas os scripts estão claros.

## Principais integrações

- NestJS CLI;
- Prisma CLI;
- Jest;
- ESLint;
- Prettier;
- Cloudinary;
- bibliotecas documentais.

## Observações finais

O fluxo recomendado para produção é:

```bash
npm install
npm run db:migrate:deploy
npm run db:generate
npm run build
npm run start:prod
```

O ponto mais importante é manter migrations fora do build e executá-las de forma explícita em etapa controlada de deploy.
