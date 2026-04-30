# Módulo: Arquitetura Geral Backend

---

# 1. Visão Geral

## Objetivo

Documentar a arquitetura global da Braille API, incluindo bootstrap, módulos NestJS, pipeline HTTP, validação global, segurança transversal, cache, rate limiting, filtros de exceção e organização por domínio.

## Responsabilidade

A arquitetura geral é responsável por coordenar o ciclo de vida da aplicação backend, registrar módulos, aplicar middlewares globais, configurar provedores transversais e garantir que todas as rotas sigam uma base comum de segurança, validação e observabilidade.

## Fluxo de Funcionamento

1. `main.ts` cria a aplicação NestJS.
2. Middlewares Express configuram limite de payload, headers de segurança e compressão.
3. O prefixo global `/api` é aplicado.
4. CORS é configurado para origens autorizadas.
5. `ValidationPipe` global valida e transforma payloads.
6. Swagger é configurado em `/docs`.
7. `AppModule` carrega módulos funcionais e provedores globais.

---

# 2. Arquitetura e Metodologias

## Padrões Arquiteturais Identificados

- Modular Architecture.
- Service Layer.
- Controller-Service Pattern.
- Dependency Injection.
- DTO Pattern.
- Guard Pattern.
- Interceptor Pattern.
- Exception Filter Pattern.
- ORM/Data Mapper com Prisma.

## Justificativa Técnica

A escolha por NestJS favorece modularidade, injeção de dependência e separação de responsabilidades. O backend é organizado por domínios funcionais, permitindo manutenção isolada e evolução incremental sem concentrar regras de negócio em um único módulo.

---

# 3. Fluxo Interno do Código

## Fluxo de Execução

1. Entrada HTTP chega ao servidor NestJS.
2. Middleware de JSON/urlencoded processa payload até 20 MB.
3. Helmet aplica headers de proteção.
4. Compression ativa compactação GZIP.
5. CORS valida origem.
6. Rotas recebem prefixo `/api`.
7. `ValidationPipe` remove campos extras, rejeita payloads inválidos e transforma tipos.
8. Guards validam autenticação e autorização quando usados.
9. Controllers delegam para services.
10. Services acessam Prisma, Cloudinary, cache ou outros serviços.
11. Filtros globais normalizam erros.
12. Resposta retorna ao cliente.

## Dependências Internas

- `src/main.ts`
- `src/app.module.ts`
- `src/common/config/env.validation.ts`
- `src/common/config/swagger.config.ts`
- `src/common/filters/prisma-exception.filter.ts`
- `src/common/interceptors/audit.interceptor.ts`
- `src/prisma/prisma.module.ts`

## Dependências Externas

- `@nestjs/common`
- `@nestjs/core`
- `@nestjs/config`
- `@nestjs/cache-manager`
- `@nestjs/throttler`
- `@nestjs/schedule`
- `helmet`
- `compression`
- `class-validator`
- `class-transformer`
- `swagger-ui-express`

---

# 4. Dicionário Técnico

## Variáveis

| Nome | Tipo | Objetivo | Impacto |
|---|---|---|---|
| `AppModule` | Classe NestJS | Módulo raiz da aplicação | Centraliza imports e providers globais |
| `validateEnv` | Função | Validação central das variáveis de ambiente | Impede aplicação subir com configuração inválida |
| `CACHE_TTL` | number | TTL padrão de cache | Afeta rotas cacheadas |
| `THROTTLER_TTL` | number | Janela de rate limit | Controla abuso de requisições |
| `THROTTLER_LIMIT` | number | Quantidade permitida na janela | Protege contra força bruta |
| `PORT` | number/string | Porta HTTP da API | Define endereço de execução |

## Funções e Métodos

### `bootstrap()`

- Objetivo: inicializar servidor NestJS.
- Parâmetros: nenhum.
- Retorno: `Promise<void>`.
- Exceções: pode falhar se módulos, variáveis de ambiente ou porta estiverem inválidos.
- Dependências: `NestFactory`, `AppModule`, `ValidationPipe`, `helmet`, `compression`, `setupSwagger`.

## Classes

### `AppModule`

- Responsabilidade: módulo raiz.
- Atributos: não possui atributos próprios.
- Composição: importa módulos de domínio e registra providers globais.

---

# 5. Serviços e Integrações

## APIs

- Prefixo global: `/api`.
- Swagger: `/docs`.

## Banco de Dados

O banco é acessado por `PrismaModule`, que disponibiliza `PrismaService` para os módulos de domínio.

## Serviços Externos

- Cloudinary em `UploadModule`.
- PostgreSQL via Prisma.

---

# 6. Segurança e Qualidade

## Segurança

- Helmet protege headers HTTP.
- CORS restringe origens.
- ValidationPipe remove campos extras.
- ThrottlerGuard aplica rate limit global.
- Filtros Prisma evitam exposição de detalhes internos.

## Qualidade

- Arquitetura modular.
- Scripts separados para build e migration.
- TypeScript e DTOs para contratos.

## Performance

- Cache global em memória.
- Compressão GZIP.
- Payload limitado.

---

# 7. Regras de Negócio

- Toda rota protegida deve usar `AuthGuard`.
- Toda rota com restrição de perfil deve usar `RolesGuard` e `@Roles`.
- Erros Prisma devem passar pelos filtros globais.
- Migrations devem ser aplicadas fora do build.

---

# 8. Pontos de Atenção

- `console.log` em produção pode ser substituído por logger estruturado.
- CORS deve ser revisado quando houver novo domínio do frontend.
- Cache em memória não é distribuído; em múltiplas instâncias deve migrar para Redis.

---

# 9. Relação com Outros Módulos

Todos os módulos dependem do `AppModule` para registro e do bootstrap global para validação, segurança, CORS, Swagger e prefixo de rota.

---

# 10. Resumo Técnico Final

A arquitetura geral da Braille API é modular, orientada a serviços e adequada para manutenção incremental. O nível de criticidade é alto porque qualquer configuração global afeta todos os módulos da API.