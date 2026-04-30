# 04 — Configuração e Validação de Ambiente (`env.validation.ts`)

---

# 1. Visão Geral

## Objetivo

Este documento descreve o arquivo:

```txt
src/common/config/env.validation.ts
```

Esse arquivo centraliza a validação das variáveis de ambiente da Braille API. Ele é executado no startup por meio do `ConfigModule.forRoot()` configurado no `AppModule`.

O objetivo é impedir que a aplicação suba com configurações críticas ausentes, inválidas ou inseguras, especialmente relacionadas a banco de dados, JWT, Cloudinary, frontend, cache, throttling e senha padrão de usuários.

## Responsabilidade

O módulo de validação de ambiente é responsável por:

- validar `NODE_ENV`;
- exigir variáveis obrigatórias globais;
- exigir variáveis adicionais em produção;
- validar formatos de URL;
- validar porta HTTP;
- validar números positivos para cache e throttling;
- validar força mínima de segredos em produção;
- retornar uma configuração normalizada para o `ConfigService`;
- falhar cedo no startup caso o ambiente esteja incorreto.

## Fluxo de Funcionamento

Fluxo principal:

```txt
ConfigModule.forRoot({ validate: validateEnv })
  ↓
validateEnv(config)
  ↓
parseNodeEnv(config)
  ↓
valida variáveis obrigatórias globais
  ↓
se production: valida variáveis obrigatórias de produção
  ↓
se production: valida força mínima de segredos
  ↓
valida FRONTEND_URL se existir
  ↓
normaliza PORT, CACHE_TTL, THROTTLER_TTL e THROTTLER_LIMIT
  ↓
se houver erros: throw Error
  ↓
retorna configuração validada
```

---

# 2. Arquitetura e Metodologias

## Padrões Arquiteturais Identificados

- **Configuration Validation Pattern**: validação explícita antes da aplicação iniciar.
- **Fail Fast**: falha no startup se o ambiente estiver inválido.
- **Environment-driven Configuration**: comportamento operacional controlado por variáveis de ambiente.
- **Defensive Programming**: normalização de strings, números, URLs e portas.
- **Security by Configuration**: reforço de requisitos de segredos em produção.
- **Pure Function Design**: funções auxiliares puras, previsíveis e testáveis.

## Justificativa Técnica

Aplicações backend dependem fortemente de variáveis externas. Se a API iniciar sem banco, JWT ou credenciais Cloudinary válidas, os erros apareceriam apenas durante uso real do sistema, causando falhas difíceis de diagnosticar.

A validação centralizada evita esse problema ao bloquear o startup quando o ambiente está incorreto.

Benefícios:

- reduz falhas tardias;
- melhora previsibilidade de deploy;
- protege contra configuração insegura;
- documenta variáveis esperadas no próprio código;
- padroniza valores padrão operacionais;
- facilita auditoria de produção.

---

# 3. Fluxo Interno do Código

## Fluxo de Execução

### 1. Tipagem base

```ts
type EnvConfig = Record<string, unknown>;
```

Define o formato genérico recebido pelo validador.

### 2. Ambientes permitidos

```ts
type NodeEnv = 'development' | 'test' | 'production';

const NODE_ENVS_PERMITIDOS: NodeEnv[] = ['development', 'test', 'production'];
```

A API aceita apenas três valores formais para `NODE_ENV`:

- `development`;
- `test`;
- `production`.

Caso `NODE_ENV` esteja ausente, o valor padrão é `development`.

### 3. Variáveis obrigatórias globais

```ts
const VARIAVEIS_OBRIGATORIAS = [
  'DATABASE_URL',
  'DIRECT_URL',
  'JWT_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
] as const;
```

Essas variáveis são exigidas em todos os ambientes.

Motivo:

- `DATABASE_URL` e `DIRECT_URL`: necessárias para Prisma/PostgreSQL;
- `JWT_SECRET`: necessário para assinar tokens;
- `CLOUDINARY_*`: necessário para upload, documentos, imagens e certificados.

### 4. Variáveis obrigatórias em produção

```ts
const VARIAVEIS_OBRIGATORIAS_PRODUCAO = ['FRONTEND_URL', 'SENHA_PADRAO_USUARIO'] as const;
```

Em produção, além das variáveis globais, também são obrigatórias:

- `FRONTEND_URL`;
- `SENHA_PADRAO_USUARIO`.

Justificativa:

- `FRONTEND_URL` evita CORS incompleto em deploy real;
- `SENHA_PADRAO_USUARIO` garante que criação/reset de usuários tenha senha inicial controlada por ambiente.

### 5. Normalização de string

```ts
function asString(config: EnvConfig, key: string): string | undefined
```

Responsabilidade:

- ler valor do objeto de ambiente;
- garantir que seja string;
- aplicar `trim()`;
- retornar `undefined` se estiver vazio.

Essa função evita aceitar valores vazios como válidos.

### 6. Obrigatoriedade de string

```ts
function requireString(config: EnvConfig, key: string, errors: string[]): string | undefined
```

Responsabilidade:

- chamar `asString()`;
- adicionar erro se a variável não existir ou estiver vazia;
- retornar valor válido quando presente.

Essa função acumula erros em vez de lançar imediatamente.

### 7. Validação do `NODE_ENV`

```ts
function parseNodeEnv(config: EnvConfig, errors: string[]): NodeEnv
```

Responsabilidade:

- obter `NODE_ENV`;
- aplicar default `development`;
- validar se pertence à lista permitida;
- adicionar erro se inválido.

Se inválido, retorna `development` como fallback interno, mas o erro acumulado fará `validateEnv()` lançar exceção no final.

### 8. Números inteiros positivos

```ts
function parsePositiveInteger(config: EnvConfig, key: string, defaultValue: number, errors: string[]): number
```

Responsabilidade:

- aceitar valores ausentes e aplicar default;
- converter valor para número;
- validar se é inteiro positivo;
- registrar erro se inválido.

Usado para:

- `PORT`;
- `CACHE_TTL`;
- `THROTTLER_TTL`;
- `THROTTLER_LIMIT`.

### 9. Validação da porta

```ts
function parsePort(config: EnvConfig, errors: string[]): number
```

Responsabilidade:

- reaproveitar `parsePositiveInteger()`;
- aplicar default `3000`;
- validar intervalo permitido de porta: `1` a `65535`.

### 10. Validação de URL

```ts
function validateUrlIfPresent(config: EnvConfig, key: string, errors: string[]): void
```

Responsabilidade:

- validar URL somente se a variável existir;
- usar `new URL(value)`;
- aceitar apenas protocolos `http:` e `https:`.

Atualmente usada para validar `FRONTEND_URL`.

### 11. Validação de segredos em produção

```ts
function validateProductionSecrets(config: EnvConfig, errors: string[]): void
```

Responsabilidade:

- validar tamanho mínimo do `JWT_SECRET` em produção;
- validar tamanho mínimo da `SENHA_PADRAO_USUARIO` em produção.

Regras:

- `JWT_SECRET`: mínimo de 32 caracteres;
- `SENHA_PADRAO_USUARIO`: mínimo de 8 caracteres.

### 12. Função principal `validateEnv()`

```ts
export function validateEnv(config: EnvConfig): EnvConfig
```

Responsabilidade:

- coordenar todas as validações;
- acumular erros;
- retornar configuração normalizada;
- lançar exceção em caso de erro.

Se houver erros:

```ts
throw new Error(`Configuração de ambiente inválida:\n- ${errors.join('\n- ')}`);
```

---

# 4. Dicionário Técnico

## Variáveis

| Nome | Tipo | Objetivo | Valor esperado | Impacto no sistema |
|---|---|---|---|---|
| `NODE_ENV` | string | Define ambiente runtime | `development`, `test`, `production` | Altera regras obrigatórias e segurança |
| `DATABASE_URL` | string | String principal de conexão PostgreSQL | URL PostgreSQL válida | Prisma depende dela para operar |
| `DIRECT_URL` | string | Conexão direta do banco | URL PostgreSQL válida | Usada em cenários de migration/conexão direta |
| `JWT_SECRET` | string | Segredo para assinatura JWT | String forte | Se fraco, compromete autenticação |
| `CLOUDINARY_CLOUD_NAME` | string | Nome da conta Cloudinary | String não vazia | Necessário para uploads |
| `CLOUDINARY_API_KEY` | string | Chave da API Cloudinary | String não vazia | Necessário para autenticar upload |
| `CLOUDINARY_API_SECRET` | string | Segredo Cloudinary | String não vazia | Criticidade alta; não deve vazar |
| `FRONTEND_URL` | string | Origem oficial do frontend | URL http/https | Obrigatória em produção; usada em CORS |
| `SENHA_PADRAO_USUARIO` | string | Senha inicial/reset de usuários | Mínimo 8 caracteres em produção | Afeta segurança de contas novas/resetadas |
| `PORT` | number | Porta HTTP da API | 1 a 65535 | Define onde servidor escuta |
| `CACHE_TTL` | number | TTL padrão de cache | Inteiro positivo | Afeta performance e frescor de dados |
| `THROTTLER_TTL` | number | Janela de rate limit | Inteiro positivo | Afeta bloqueio de abuso |
| `THROTTLER_LIMIT` | number | Limite de requisições por janela | Inteiro positivo | Afeta proteção contra força bruta/spam |

## Funções e Métodos

### `asString(config, key)`

| Item | Descrição |
|---|---|
| Objetivo | Ler e normalizar uma variável string |
| Parâmetros | `config`, `key` |
| Retorno | `string | undefined` |
| Exceções | Não lança |
| Dependências | Nenhuma |

### `requireString(config, key, errors)`

| Item | Descrição |
|---|---|
| Objetivo | Exigir uma variável string obrigatória |
| Parâmetros | `config`, `key`, `errors` |
| Retorno | `string | undefined` |
| Exceções | Não lança diretamente; acumula erro |
| Dependências | `asString()` |

### `parseNodeEnv(config, errors)`

| Item | Descrição |
|---|---|
| Objetivo | Validar e normalizar `NODE_ENV` |
| Parâmetros | `config`, `errors` |
| Retorno | `NodeEnv` |
| Exceções | Não lança diretamente; acumula erro |
| Dependências | `asString()`, `NODE_ENVS_PERMITIDOS` |

### `parsePositiveInteger(config, key, defaultValue, errors)`

| Item | Descrição |
|---|---|
| Objetivo | Converter variável para inteiro positivo |
| Parâmetros | `config`, `key`, `defaultValue`, `errors` |
| Retorno | `number` |
| Exceções | Não lança diretamente; acumula erro |
| Dependências | `Number.isInteger()` |

### `parsePort(config, errors)`

| Item | Descrição |
|---|---|
| Objetivo | Validar porta da API |
| Parâmetros | `config`, `errors` |
| Retorno | `number` |
| Exceções | Não lança diretamente; acumula erro |
| Dependências | `parsePositiveInteger()` |

### `validateUrlIfPresent(config, key, errors)`

| Item | Descrição |
|---|---|
| Objetivo | Validar URL opcional |
| Parâmetros | `config`, `key`, `errors` |
| Retorno | `void` |
| Exceções | Não lança diretamente; acumula erro |
| Dependências | `URL` nativo do Node.js |

### `validateProductionSecrets(config, errors)`

| Item | Descrição |
|---|---|
| Objetivo | Validar força mínima de segredos em produção |
| Parâmetros | `config`, `errors` |
| Retorno | `void` |
| Exceções | Não lança diretamente; acumula erro |
| Dependências | `asString()` |

### `validateEnv(config)`

| Item | Descrição |
|---|---|
| Objetivo | Função principal de validação do ambiente |
| Parâmetros | `config` |
| Retorno | `EnvConfig` normalizado |
| Exceções | Lança `Error` se houver erros acumulados |
| Dependências | Todas as funções auxiliares do arquivo |

## Classes

O arquivo não declara classes. Ele usa funções puras e tipos TypeScript.

## Interfaces e Tipagens

### `EnvConfig`

```ts
type EnvConfig = Record<string, unknown>;
```

Representa o objeto de ambiente recebido pelo `ConfigModule`.

### `NodeEnv`

```ts
type NodeEnv = 'development' | 'test' | 'production';
```

Define os ambientes permitidos.

---

# 5. Serviços e Integrações

## APIs

Este arquivo não expõe endpoints HTTP.

Ele afeta todas as APIs indiretamente, pois define se a aplicação conseguirá iniciar e quais configurações estarão disponíveis para módulos e controllers.

## Banco de Dados

Variáveis relacionadas:

- `DATABASE_URL`;
- `DIRECT_URL`.

Essas variáveis são obrigatórias em todos os ambientes porque Prisma e migrations dependem delas.

## Serviços Externos

### Cloudinary

Variáveis relacionadas:

- `CLOUDINARY_CLOUD_NAME`;
- `CLOUDINARY_API_KEY`;
- `CLOUDINARY_API_SECRET`.

Essas variáveis são exigidas globalmente porque uploads, laudos, termos, capas de comunicados, imagens de certificados e PDFs podem depender do Cloudinary.

### Frontend

Variável relacionada:

- `FRONTEND_URL`.

Obrigatória em produção para garantir CORS correto.

---

# 6. Segurança e Qualidade

## Segurança

Pontos fortes:

- exige `JWT_SECRET` em todos os ambientes;
- exige `JWT_SECRET` com pelo menos 32 caracteres em produção;
- exige senha padrão com pelo menos 8 caracteres em produção;
- impede produção sem `FRONTEND_URL`;
- rejeita URLs inválidas;
- rejeita `NODE_ENV` desconhecido;
- rejeita porta inválida;
- rejeita TTLs e limites não positivos.

## Qualidade

O arquivo usa funções pequenas e coesas, o que facilita teste unitário.

A decisão de acumular erros em um array melhora a experiência de debug, pois permite exibir todas as variáveis inválidas de uma vez.

## Performance

A validação ocorre apenas no startup. Não há impacto relevante em runtime após a aplicação iniciar.

---

# 7. Regras de Negócio

Embora seja um arquivo de infraestrutura, ele impõe regras operacionais importantes:

- a API não deve iniciar sem banco configurado;
- a API não deve iniciar sem segredo JWT;
- a API não deve iniciar sem Cloudinary configurado;
- produção exige frontend oficial configurado;
- produção exige senha padrão de usuário configurada;
- produção exige segredo JWT forte;
- produção exige senha padrão com tamanho mínimo;
- `NODE_ENV` deve ser um ambiente conhecido;
- `PORT` deve estar em faixa válida;
- cache e throttling devem usar inteiros positivos.

Essas regras reduzem risco de deploy inseguro ou incompleto.

---

# 8. Pontos de Atenção

## Riscos

- `CLOUDINARY_*` é obrigatório até mesmo em ambientes de teste e desenvolvimento. Isso pode dificultar testes locais sem credenciais reais.
- `JWT_SECRET` só tem tamanho mínimo validado em produção; em desenvolvimento e teste basta existir.
- `FRONTEND_URL` é validado se existir, mas só é obrigatório em produção.
- Não há validação específica de formato PostgreSQL para `DATABASE_URL` e `DIRECT_URL`; apenas obrigatoriedade.

## Débitos Técnicos

- Avaliar permitir Cloudinary opcional em ambiente `test`, com mock nos testes.
- Validar protocolo/estrutura de `DATABASE_URL` e `DIRECT_URL` como PostgreSQL.
- Adicionar validação de múltiplas origens CORS se o sistema evoluir para lista por ambiente.
- Considerar política mais rígida para `JWT_SECRET` também em `development` compartilhado.

## Melhorias Futuras

- Criar schema de validação com Joi, Zod ou class-validator caso a complexidade aumente.
- Documentar `.env.example` sincronizado com este arquivo.
- Criar testes unitários específicos para `validateEnv()`.
- Separar variáveis por domínio: database, auth, cloudinary, cache, throttling.

---

# 9. Relação com Outros Módulos

| Módulo | Relação |
|---|---|
| `AppModule` | Usa `validateEnv` no `ConfigModule.forRoot()` |
| `main.ts` | Usa `PORT` e CORS usa frontend configurado indiretamente |
| `AuthModule/AuthService` | Depende de `JWT_SECRET` e senha padrão em fluxos de usuário |
| `UploadModule` | Depende de credenciais Cloudinary |
| `CertificadosModule` | Depende de Cloudinary para artes e PDFs |
| `PrismaModule` | Depende de `DATABASE_URL` e `DIRECT_URL` |
| `CacheModule` | Usa `CACHE_TTL` |
| `ThrottlerModule` | Usa `THROTTLER_TTL` e `THROTTLER_LIMIT` |
| `UsersModule` | Pode usar `SENHA_PADRAO_USUARIO` para criação/reset em produção |

---

# 10. Resumo Técnico Final

O arquivo `env.validation.ts` é uma peça importante de robustez operacional da Braille API. Ele transforma configurações externas em um contrato validado e impede que a aplicação rode com ambiente incompleto ou inseguro.

## Função do módulo

Validar e normalizar variáveis de ambiente no startup.

## Importância no sistema

Alta. Sem essa validação, erros críticos poderiam aparecer apenas em runtime, como falha de login, falha no banco ou falha de upload.

## Nível de criticidade

Alto, pois envolve banco, JWT, Cloudinary, CORS, senha padrão e controles de performance/segurança.

## Complexidade

Baixa/Média. O arquivo é simples, mas cobre várias áreas sensíveis da aplicação.

## Principais integrações

- `ConfigModule`;
- Prisma/PostgreSQL;
- JWT;
- Cloudinary;
- CacheModule;
- ThrottlerModule;
- frontend via CORS.

## Observações finais

A validação atual está bem estruturada e segue o princípio fail fast. Os principais aprimoramentos futuros são validar melhor URLs de banco, flexibilizar Cloudinary em testes e manter um `.env.example` sempre sincronizado com este contrato.
