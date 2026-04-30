# 01 — Visão Geral da Arquitetura Backend

---

# 1. Visão Geral

## Objetivo

Este documento descreve a arquitetura geral da **Braille API**, aplicação backend desenvolvida em **NestJS**, **TypeScript**, **Prisma ORM** e **PostgreSQL**.

O foco deste arquivo é apresentar a visão macro da arquitetura, os padrões adotados, o fluxo HTTP principal, a organização por camadas e a relação entre os principais módulos. Detalhes específicos de bootstrap, `AppModule`, autenticação, banco, módulos de negócio, rotas e entidades serão tratados em arquivos próprios conforme o `00-indice-geral.md`.

## Responsabilidade

A arquitetura backend é responsável por:

- expor APIs REST para o frontend administrativo e público;
- centralizar regras de negócio institucionais;
- validar dados de entrada com DTOs e pipes;
- autenticar usuários por JWT;
- autorizar ações por perfil de acesso;
- controlar sessões com refresh token rotativo;
- persistir dados em PostgreSQL via Prisma;
- integrar uploads e documentos com Cloudinary;
- gerar documentos e certificados;
- registrar auditoria de ações críticas;
- aplicar segurança transversal em requisições HTTP;
- organizar o sistema em módulos de domínio independentes.

## Fluxo de Funcionamento

Fluxo macro da aplicação:

```txt
Cliente HTTP / Frontend Angular
  ↓
NestJS bootstrap em main.ts
  ↓
Middlewares globais: JSON limit, URL encoded, Helmet, Compression, CORS
  ↓
Prefixo global /api
  ↓
ValidationPipe global
  ↓
Guards globais e locais: ThrottlerGuard, AuthGuard, RolesGuard
  ↓
Controllers por módulo
  ↓
DTOs, Pipes, Interceptors e Decorators
  ↓
Services com regras de negócio
  ↓
PrismaService / UploadService / AuditLogService / bibliotecas externas
  ↓
PostgreSQL / Cloudinary / geração de arquivos
  ↓
Resposta HTTP padronizada ou exceção tratada
```

---

# 2. Arquitetura e Metodologias

## Padrões Arquiteturais Identificados

A API utiliza uma arquitetura modular típica do NestJS, combinando os seguintes padrões:

- **Modular Architecture**: cada domínio possui seu próprio módulo, controller, service e DTOs.
- **MVC adaptado ao backend**: controllers recebem requisições, services executam regras e Prisma representa a persistência.
- **Service Layer**: regras de negócio são concentradas nos services.
- **DTO Pattern**: contratos de entrada são definidos por DTOs e validados por `class-validator`.
- **Dependency Injection**: dependências são injetadas pelo container do NestJS.
- **Guard Pattern**: autenticação e autorização são aplicadas por guards.
- **Interceptor Pattern**: auditoria e cache utilizam interceptors.
- **Pipe Pattern**: validação e sanitização são aplicadas antes da execução do service.
- **Exception Filter Pattern**: erros Prisma são tratados por filtros globais.
- **ORM Pattern**: acesso ao banco é abstraído pelo Prisma Client.
- **RBAC — Role-Based Access Control**: autorização baseada em perfis.
- **Session-based Refresh Token Rotation**: refresh token é controlado por sessão dedicada no banco.
- **Soft Delete / Arquivamento Lógico**: módulos críticos preservam histórico em vez de excluir fisicamente dados operacionais.

## Justificativa Técnica

A arquitetura modular foi escolhida porque o sistema possui múltiplos domínios institucionais: autenticação, usuários, alunos, turmas, frequências, comunicados, documentos, certificados, CMS público e auditoria.

Separar esses domínios em módulos reduz acoplamento e permite que cada área evolua com menor impacto sobre as demais. Essa decisão favorece:

- manutenção incremental;
- isolamento de regras de negócio;
- controle de permissões por domínio;
- documentação por módulo;
- testes unitários e e2e por contexto;
- rastreabilidade entre controller, service, DTO e entidade;
- escalabilidade organizacional da base de código.

O uso do NestJS reforça padrões de arquitetura empresarial por oferecer decorators, injeção de dependência, módulos, guards, pipes, interceptors e filtros como recursos nativos.

O Prisma centraliza o modelo de dados em `schema.prisma`, permitindo tipagem forte, migrations versionadas e relação clara entre código e banco PostgreSQL.

---

# 3. Fluxo Interno do Código

## Fluxo de Execução

### 1. Entrada

A entrada ocorre por requisições HTTP enviadas ao backend, geralmente pelo frontend Angular. Todas as rotas são prefixadas com:

```txt
/api
```

Exemplos:

```txt
/api/auth/login
/api/users
/api/beneficiaries
/api/turmas
/api/frequencias
```

### 2. Bootstrap

A aplicação é inicializada em `src/main.ts`.

O bootstrap aplica middlewares globais e configurações transversais:

- limite de payload JSON e URL encoded;
- headers de segurança com Helmet;
- compressão HTTP;
- CORS;
- prefixo global `/api`;
- `ValidationPipe` global;
- Swagger.

### 3. Composição Global

O `AppModule` centraliza a importação de módulos e providers globais.

Ele registra:

- `ConfigModule` global com validação de ambiente;
- `CacheModule` global;
- `ThrottlerModule` global;
- `PrismaModule`;
- `ScheduleModule`;
- módulos funcionais;
- `ThrottlerGuard` global;
- `AuditInterceptor` global;
- filtros globais para erros Prisma.

### 4. Validações

A validação global remove campos não definidos nos DTOs e rejeita campos extras. Isso reduz risco de payloads inesperados, mass assignment e inconsistência nos services.

### 5. Autenticação e Autorização

Rotas protegidas usam `AuthGuard` para validar JWT. Rotas com restrição de perfil usam `RolesGuard` e o decorator `@Roles()`.

O controle de perfil é aplicado por módulo e por método, conforme a criticidade da rota.

### 6. Controller

Controllers são responsáveis por:

- declarar rotas;
- aplicar guards, roles, interceptors e pipes;
- receber DTOs;
- extrair parâmetros de rota e query params;
- chamar o service correspondente;
- manter a camada HTTP fina.

### 7. Service

Services concentram:

- regras de negócio;
- validações de domínio;
- chamadas ao Prisma;
- integração com Cloudinary ou bibliotecas externas;
- auditoria manual em módulos que usam `@SkipAudit()`;
- tratamento de cenários especiais;
- composição de retorno.

### 8. Persistência

A persistência é feita com Prisma ORM sobre PostgreSQL.

Modelo principal:

```txt
prisma/schema.prisma
```

Migrations:

```txt
prisma/migrations/
```

### 9. Retorno

A API pode retornar dados diretamente ou por meio de DTOs de resposta padronizados, como `ApiResponse`. Erros Prisma são tratados por filtros globais e erros de validação por pipes.

## Dependências Internas

Principais dependências internas:

- `src/main.ts`;
- `src/app.module.ts`;
- `src/prisma/`;
- `src/auth/`;
- `src/common/`;
- `src/users/`;
- `src/beneficiaries/`;
- `src/turmas/`;
- `src/frequencias/`;
- `src/comunicados/`;
- `src/upload/`;
- `src/site-config/`;
- `src/audit-log/`;
- `src/atestados/`;
- `src/laudos/`;
- `src/apoiadores/`;
- `src/certificados/`;
- `src/dashboard/`;
- `src/contatos/`.

## Dependências Externas

| Biblioteca | Uso arquitetural |
|---|---|
| `@nestjs/common` | Controllers, decorators, exceptions, pipes e providers |
| `@nestjs/core` | Bootstrap, guards/interceptors/filtros globais |
| `@nestjs/config` | Variáveis de ambiente e configuração global |
| `@nestjs/jwt` | Geração e validação de JWT |
| `@nestjs/cache-manager` | Cache em memória e interceptors de cache |
| `@nestjs/throttler` | Rate limiting global |
| `@nestjs/swagger` | Documentação OpenAPI |
| `@prisma/client` | ORM e tipagem de banco |
| `bcrypt` | Hash de senha e secrets de refresh token |
| `cloudinary` | Armazenamento externo de arquivos |
| `exceljs` | Importação/exportação de planilhas `.xlsx` |
| `pdf-lib` | Geração de certificados em PDF |
| `qrcode` | Geração de QR Code para certificados |
| `helmet` | Segurança de headers HTTP |
| `compression` | Compressão GZIP |
| `class-validator` | Validação de DTOs |
| `class-transformer` | Transformação de tipos em DTOs |
| `dompurify` e `jsdom` | Sanitização HTML |

---

# 4. Dicionário Técnico

## Variáveis

| Nome | Tipo | Objetivo | Valor esperado | Impacto no sistema |
|---|---|---|---|---|
| `PORT` | variável de ambiente | Define a porta HTTP da API | Número ou ausente | Se ausente, usa 3000 |
| `DATABASE_URL` | variável de ambiente | URL principal do PostgreSQL | String de conexão PostgreSQL | Necessária para Prisma operar |
| `DIRECT_URL` | variável de ambiente | URL direta do banco | String de conexão PostgreSQL | Usada por Prisma/migrations em alguns ambientes |
| `JWT_SECRET` | variável de ambiente | Chave de assinatura JWT | String forte | Criticidade alta de segurança |
| `FRONTEND_URL` | variável de ambiente | Origem permitida no CORS | URL do frontend | Controla acesso do frontend deployado |
| `CACHE_TTL` | variável de ambiente | TTL padrão do cache | Número em milissegundos | Afeta performance e frescor de dados |
| `THROTTLER_TTL` | variável de ambiente | Janela de rate limit | Número em milissegundos | Proteção contra abuso |
| `THROTTLER_LIMIT` | variável de ambiente | Limite de requisições por janela | Número inteiro | Proteção contra força bruta e spam |
| `CLOUDINARY_CLOUD_NAME` | variável de ambiente | Nome da conta Cloudinary | String | Necessária para uploads |
| `CLOUDINARY_API_KEY` | variável de ambiente | Chave pública Cloudinary | String | Necessária para uploads |
| `CLOUDINARY_API_SECRET` | variável de ambiente | Segredo Cloudinary | String | Criticidade alta de segurança |

## Funções e Métodos Arquiteturais

| Função/Método | Local | Objetivo |
|---|---|---|
| `bootstrap()` | `src/main.ts` | Inicializar aplicação NestJS e configurar middlewares globais |
| `ConfigModule.forRoot()` | `AppModule` | Carregar e validar ambiente |
| `CacheModule.registerAsync()` | `AppModule` | Configurar cache global |
| `ThrottlerModule.forRootAsync()` | `AppModule` | Configurar limitação global de requisições |
| `setupSwagger()` | `src/common/config/swagger.config.ts` | Configurar documentação Swagger |

## Classes

| Classe | Responsabilidade |
|---|---|
| `AppModule` | Compor módulos, providers globais, cache, rate limit e filtros |
| `PrismaService` | Fornecer acesso ao Prisma Client |
| `AuthGuard` | Validar JWT e usuário ativo |
| `RolesGuard` | Validar autorização por role |
| `AuditInterceptor` | Registrar mutações críticas |
| `PrismaExceptionFilter` | Traduzir erros Prisma em respostas HTTP |
| `PrismaValidationFilter` | Tratar erros de validação Prisma |

## Interfaces e Tipagens

Tipagens globais importantes incluem:

- payload JWT autenticado;
- interfaces de request autenticado;
- DTOs por módulo;
- entidades geradas pelo Prisma Client;
- enums Prisma, como `Role`, `TurmaStatus`, `StatusFrequencia` e `AuditAcao`.

---

# 5. Serviços e Integrações

## APIs

A API é RESTful, documentada via Swagger e organizada por controllers.

Características gerais:

- prefixo global: `/api`;
- documentação Swagger em `/docs`;
- rotas protegidas por JWT;
- autorização por `Role`;
- validação global de DTOs;
- cache seletivo em rotas públicas ou listas de leitura;
- uploads via multipart em módulos específicos.

## Banco de Dados

O banco principal é PostgreSQL, acessado por Prisma ORM.

Características:

- schema versionado em `prisma/schema.prisma`;
- migrations em `prisma/migrations/`;
- entidades com UUID na maioria das tabelas;
- índices para campos de busca frequente;
- relacionamentos explícitos entre entidades;
- enums para status, roles e classificações;
- campos de arquivamento/status em vez de exclusão física em módulos sensíveis.

## Serviços Externos

| Serviço | Finalidade |
|---|---|
| Cloudinary | Armazenamento de imagens, PDFs, laudos, termos, capas e certificados |
| Swagger UI | Interface de documentação da API |
| PostgreSQL | Banco relacional principal |

---

# 6. Segurança e Qualidade

## Segurança

A arquitetura aplica segurança em múltiplas camadas:

- `helmet()` para headers HTTP;
- CORS restrito a origens conhecidas;
- `ValidationPipe` global com `whitelist` e `forbidNonWhitelisted`;
- `ThrottlerGuard` global contra abuso de requisições;
- JWT para rotas protegidas;
- refresh token rotativo por sessão;
- bcrypt para senhas e secrets de refresh token;
- RBAC por `Role`;
- sanitização HTML em rotas de conteúdo;
- restrição de pastas permitidas no Cloudinary;
- auditoria de mutações críticas;
- filtros globais para evitar exposição de detalhes internos do Prisma.

## Qualidade

A qualidade é sustentada por:

- TypeScript;
- DTOs validados;
- separação controller/service;
- Prisma Client tipado;
- scripts de lint, format e test;
- Swagger para contratos HTTP;
- documentação incremental por módulo.

## Performance

Estratégias de performance identificadas:

- compressão GZIP;
- cache em memória com `CacheModule`;
- cache seletivo com `CacheInterceptor`;
- índices no Prisma schema;
- consultas com `select` mínimo em áreas sensíveis;
- upload em memória controlado por limites;
- separação de build e migrations.

---

# 7. Regras de Negócio

Regras globais identificadas:

- toda rota da API fica sob `/api`;
- rotas sensíveis exigem JWT válido;
- autorização é feita por perfis;
- o módulo `users` é restrito ao `ADMIN`;
- refresh token é opaco e vinculado a uma sessão (`UserSession`);
- a rotação de refresh token preserva o hash anterior para detectar reuso real;
- uploads devem respeitar tipo, tamanho e pasta permitida;
- migrations devem ser executadas separadamente do build;
- auditoria registra ações críticas com autor, IP e user agent quando aplicável;
- dados sensíveis de alunos e usuários devem ser tratados com cuidado por LGPD.

---

# 8. Pontos de Atenção

## Riscos

- A documentação precisa acompanhar mudanças futuras na branch `dev`.
- Alguns campos legados ainda existem, como `User.refreshToken`, `User.refreshTokenExpiraEm` e `Frequencia.presente`.
- A cobertura de auditoria deve ser acompanhada por módulo.
- Cache precisa ser usado apenas onde a invalidação é previsível.
- Uploads em memória exigem controle de tamanho para evitar consumo excessivo.

## Débitos Técnicos

- Remover campos legados de refresh token em `User` após estabilizar `UserSession`.
- Remover ou migrar o campo legado `Frequencia.presente` quando todos os relatórios usarem `status`.
- Ampliar testes automatizados sobre autenticação, RBAC, importação `.xlsx`, frequência em lote e certificados.
- Criar documentação individual para cada rota e entidade.

## Melhorias Futuras

- Criar métricas estruturadas de observabilidade.
- Adicionar logs estruturados com correlação por request.
- Criar jobs de limpeza de sessões expiradas.
- Criar testes e2e de fluxo completo de sessão.
- Revisar estratégia de cache com storage externo caso a aplicação escale horizontalmente.

---

# 9. Relação com Outros Módulos

| Módulo | Relação arquitetural |
|---|---|
| Auth | Define identidade, sessão e autorização |
| Users | Define usuários internos e roles |
| Beneficiaries | Usa persistência, uploads e auditoria |
| Turmas | Usa usuários como professores e alunos por matrícula |
| Frequências | Depende de turmas, alunos e status acadêmico |
| Atestados | Integra aluno e frequência para justificar faltas |
| Comunicados | Usa usuários como autores e Cloudinary para capa |
| Site Config | Atua como CMS público com cache |
| Upload | Fornece infraestrutura de arquivos para vários módulos |
| Certificados | Depende de alunos, turmas, apoiadores, PDF e Cloudinary |
| Audit Log | Recebe eventos de ações críticas |
| Prisma | Base de persistência de todos os módulos |

---

# 10. Resumo Técnico Final

A Braille API possui uma arquitetura backend modular, coerente com aplicações institucionais de médio porte. O NestJS fornece a estrutura principal, enquanto Prisma e PostgreSQL sustentam a persistência relacional.

A aplicação adota boas práticas importantes:

- separação por módulos;
- controllers finos;
- services com regras de negócio;
- DTOs validados;
- autenticação JWT;
- refresh token por sessão;
- RBAC;
- auditoria;
- cache seletivo;
- proteção HTTP;
- integração controlada com Cloudinary;
- migrations separadas do build.

## Criticidade

Alta. A arquitetura sustenta módulos com dados pessoais, dados sensíveis, documentos médicos, frequência acadêmica e certificados institucionais.

## Complexidade

Média/Alta. A complexidade vem da quantidade de módulos, relacionamentos, documentos, regras acadêmicas, segurança de sessão, auditoria e integrações externas.

## Observação Final

Este documento estabelece apenas a visão arquitetural geral. Os detalhes de bootstrap, `AppModule`, Prisma, Auth, módulos de domínio, rotas e entidades devem ser documentados nos arquivos seguintes conforme o `00-indice-geral.md`.
