# Modulo: Core da Aplicacao

---

# 1. Visao Geral

## Objetivo

Documentar os arquivos centrais `src/main.ts`, `src/app.module.ts`, `src/app.controller.ts` e `src/app.service.ts`.

## Responsabilidade

O core inicializa a aplicacao NestJS, registra modulos, define middlewares globais, configura seguranca, cache, rate limit, scheduler, filtros, interceptores, Swagger e health check.

## Fluxo de Funcionamento

`bootstrap()` cria a aplicacao, aumenta limite de payload para `20mb`, aplica Helmet, compressao, prefixo `/api`, CORS, `ValidationPipe`, Swagger e escuta `PORT` ou `3000`. `AppModule` importa todos os modulos de dominio e registra guards/interceptors/filters globais. `AppController` oferece rota raiz e `GET /api/health`, delegando ao `AppService`.

---

# 2. Arquitetura e Metodologias

## Padroes Arquiteturais Identificados

* Composition Root em `AppModule`.
* Dependency Injection.
* Modular Monolith.
* Health Check Pattern.
* Global Middleware/Guard/Filter/Interceptor.
* Service Layer para health check.

## Justificativa Tecnica

Centralizar bootstrapping reduz configuracao duplicada. O uso de filtros globais garante padronizacao de erros Prisma. O interceptor global fornece auditoria transversal. O throttler global protege toda a API contra abuso, enquanto guards especificos continuam declarados por rota.

---

# 3. Fluxo Interno do Codigo

## Fluxo de Execucao

1. `NestFactory.create(AppModule)` cria container IoC.
2. Express recebe `json` e `urlencoded` com limite de 20 MB para suportar uploads baseados em payload.
3. Helmet adiciona headers defensivos.
4. Compression habilita gzip.
5. `setGlobalPrefix('api')` padroniza rotas.
6. CORS aceita `localhost:4200`, frontend Vercel e subdominios Render.
7. `ValidationPipe` remove campos fora do DTO e transforma tipos.
8. `setupSwagger(app)` publica documentacao em `/docs`.
9. `AppService.checkHealth()` executa `SELECT 1` via Prisma.
10. Falha no banco gera `InternalServerErrorException` sem expor detalhes internos.

## Dependencias Internas

* Todos os modules de dominio.
* `PrismaModule`.
* `AuditInterceptor`.
* `PrismaExceptionFilter` e `PrismaValidationFilter`.
* `setupSwagger`.

## Dependencias Externas

* NestJS core/common.
* `@nestjs/config`.
* `@nestjs/cache-manager`.
* `@nestjs/throttler`.
* `@nestjs/schedule`.
* `helmet`.
* `compression`.
* Express body parsers.

---

# 4. Dicionario Tecnico

## Variaveis

* `app`: instancia NestJS.
* `PORT`: porta do processo.
* `CACHE_TTL`: tempo de vida do cache global.
* `THROTTLER_TTL`: janela de rate limit.
* `THROTTLER_LIMIT`: quantidade maxima por janela.
* `origin`: allowlist CORS.
* `allowedHeaders`: cabecalhos aceitos em CORS.

## Funcoes e Metodos

* `bootstrap()`: monta e inicia a aplicacao.
* `AppService.getHello()`: retorna mensagem institucional.
* `AppService.checkHealth()`: verifica conectividade com banco.
* `AppController.getHello()`: endpoint raiz.
* `AppController.goHealthCheck()`: endpoint de integridade.

## Classes

* `AppModule`: composition root.
* `AppController`: controller de sistema.
* `AppService`: service de health check.

## Interfaces e Tipagens

Nao define DTO proprio. Usa contratos NestJS e retorno literal no health check.

---

# 5. Servicos e Integracoes

## APIs

* `GET /api`: retorna mensagem de boas-vindas.
* `GET /api/health`: retorna `{ status, database, timestamp }` quando o banco responde.

## Banco de Dados

`AppService.checkHealth()` executa `SELECT 1` por `prisma.$queryRaw`.

## Servicos Externos

Nao chama servicos externos diretamente; depende da disponibilidade do PostgreSQL.

---

# 6. Seguranca e Qualidade

## Seguranca

* Helmet para headers.
* CORS restritivo.
* DTO whitelist global.
* Rate limit global.
* Mensagem generica em erro de banco no health check.

## Qualidade

* `Logger` no `AppService`.
* Swagger centralizado.
* Filtros Prisma globais.

## Performance

* Compressao HTTP.
* Cache global disponivel.
* Health check usa query leve.

---

# 7. Regras de Negocio

* Todas as rotas sao prefixadas por `/api`, exceto documentacao Swagger configurada fora do prefixo conforme `setupSwagger`.
* Payloads grandes sao aceitos porque o sistema trafega imagens, laudos e documentos.
* CORS permite ambientes locais, Render e frontend hospedado.

---

# 8. Pontos de Atencao

* Limite de 20 MB amplia superficie de payload; deve ser acompanhado por validacoes de arquivo nos controllers de upload.
* CORS com regex Render e aceitacao de credenciais precisa ser revisado em ambientes multi-tenant.
* Health check testa somente banco, nao Cloudinary nem motor PDF.

---

# 9. Relacao com Outros Modulos

* Importa todos os modulos funcionais.
* Registra `AuditInterceptor`, que depende de `AuditLogService`.
* Registra filtros que dependem de tipos Prisma.
* `PrismaModule` sustenta health check e persistencia global.

---

# 10. Resumo Tecnico Final

O core e a fundacao operacional do backend. Sua criticidade e alta, pois qualquer configuracao global incorreta impacta toda a API. A complexidade e media: combina bootstrapping NestJS, seguranca HTTP, validacao, cache, throttling, scheduler, filtros globais e observabilidade basica.

