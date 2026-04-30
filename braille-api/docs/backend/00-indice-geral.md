# Documentação Técnica Backend — Braille API

## Objetivo

Este diretório reúne a documentação técnica da API backend do sistema Braille API. A documentação foi organizada por arquitetura, banco de dados, autenticação, usuários, alunos, uploads, conteúdo público, módulos acadêmicos e segurança operacional.

## Índice de documentos

| Arquivo | Tema |
|---|---|
| `01-arquitetura-geral.md` | Arquitetura NestJS, bootstrap, módulos globais e fluxo HTTP |
| `02-banco-dados-prisma.md` | Schema Prisma, entidades, relacionamentos, migrations e persistência |
| `03-auth-sessoes.md` | Login, JWT, refresh token, sessões, guards e autorização |
| `04-users.md` | Gestão administrativa de usuários e funcionários |
| `05-beneficiaries.md` | Gestão de alunos, importação e exportação XLSX |
| `06-upload-cloudinary.md` | Uploads, Cloudinary, validação de arquivos e exclusão segura |
| `07-conteudo-publico-cms.md` | Comunicados, CMS público, cache e invalidação |
| `08-modulos-academicos-documentais.md` | Turmas, frequência, atestados, laudos, certificados e apoiadores |
| `09-seguranca-auditoria-operacao.md` | Segurança transversal, auditoria, filtros, ambiente e operação |

## Visão geral da aplicação

A API é uma aplicação NestJS modular com Prisma ORM e PostgreSQL. O `AppModule` centraliza os módulos funcionais, configura validação de ambiente, cache global, limitação de requisições, filtros globais de exceção, auditoria global e módulos de domínio.

O bootstrap em `main.ts` aplica prefixo global `/api`, validação global, CORS, headers de segurança, compressão e Swagger em `/docs`.

## Principais domínios

- Autenticação e sessão.
- Usuários administrativos.
- Alunos e beneficiários.
- Turmas e frequências.
- Comunicados e CMS público.
- Uploads e documentos.
- Auditoria.
- Atestados, laudos, apoiadores e certificados.

## Regras globais

- Rotas protegidas exigem JWT válido.
- Roles controlam autorização por perfil.
- O módulo `users` é exclusivo para `ADMIN`.
- Refresh token usa sessão dedicada e rotação.
- Uploads são limitados por tipo, tamanho e pasta permitida.
- Mutações relevantes são auditadas.
- Migrations devem ser aplicadas separadamente do build.

## Comandos operacionais principais

```bash
npm run db:migrate:deploy
npm run db:generate
npm run build
npm run start:prod
```

## Histórico da documentação

Esta documentação foi criada para consolidar a engenharia reversa da API após a rodada de correções de segurança, sessão, cache, permissões, uploads e organização de scripts.
