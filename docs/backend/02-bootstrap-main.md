# 02 — Bootstrap da Aplicação (`main.ts`)

---

# 1. Visão Geral

## Objetivo

Este documento descreve o arquivo `src/main.ts`, responsável por inicializar a aplicação NestJS da Braille API.

O `main.ts` é o ponto de entrada runtime do backend. Ele cria a instância principal da aplicação, registra middlewares HTTP, aplica segurança transversal, define o prefixo global da API, configura CORS, ativa validação global, configura Swagger e inicia o servidor HTTP.

## Responsabilidade

O arquivo `main.ts` possui responsabilidade de bootstrap, ou seja, preparar a aplicação antes de aceitar requisições externas.

Responsabilidades principais:

- criar a aplicação NestJS a partir do `AppModule`;
- configurar limites de payload;
- aplicar headers HTTP de segurança;
- habilitar compressão GZIP;
- definir prefixo global `/api`;
- configurar CORS;
- aplicar `ValidationPipe` global;
- configurar Swagger;
- iniciar o servidor na porta configurada.

## Fluxo de Funcionamento

Fluxo executado no bootstrap:

```txt
bootstrap()
  ↓
NestFactory.create(AppModule)
  ↓
app.use(json({ limit: '20mb' }))
  ↓
app.use(urlencoded({ extended: true, limit: '20mb' }))
  ↓
app.use(helmet())
  ↓
app.use(compression())
  ↓
app.setGlobalPrefix('api')
  ↓
app.enableCors(...)
  ↓
app.useGlobalPipes(new ValidationPipe(...))
  ↓
setupSwagger(app)
  ↓
app.listen(process.env.PORT || 3000)
```

---

# 2. Arquitetura e Metodologias

## Padrões Arquiteturais Identificados

- **Bootstrap Pattern**: centralização da inicialização em uma função assíncrona `bootstrap()`.
- **Middleware Pipeline**: aplicação sequencial de middlewares Express antes das rotas.
- **Global Validation Pattern**: validação de DTOs aplicada de forma global.
- **Security by Default**: uso de Helmet, CORS controlado e validação estrita.
- **API Prefixing**: isolamento de rotas backend sob `/api`.
- **Documentation Setup**: Swagger configurado no início da aplicação.
- **Environment-driven Configuration**: porta e frontend autorizado lidos de variáveis de ambiente.

## Justificativa Técnica

O `main.ts` concentra apenas preocupações transversais de runtime. Essa separação mantém o `AppModule` responsável pela composição de dependências e módulos, enquanto o `main.ts` configura aspectos HTTP e operacionais.

Essa decisão melhora:

- clareza do ciclo de inicialização;
- previsibilidade do comportamento HTTP;
- padronização de validação em todos os módulos;
- segurança antes de qualquer controller ser executado;
- facilidade para ajustar CORS, payload e Swagger sem alterar módulos de domínio.

---

# 3. Fluxo Interno do Código

## Fluxo de Execução

### 1. Criação da aplicação

```ts
const app = await NestFactory.create(AppModule);
```

Cria uma instância NestJS baseada no módulo raiz `AppModule`.

Impacto:

- carrega providers globais;
- instancia módulos funcionais;
- inicializa guards, interceptors e filtros configurados no `AppModule`;
- prepara o container de injeção de dependência.

### 2. Limite de payload JSON

```ts
app.use(json({ limit: '20mb' }));
```

Aumenta o limite padrão do Express para payload JSON.

Motivo técnico:

- o sistema trabalha com uploads e documentos;
- alguns módulos podem receber imagens, URLs, PDFs ou payloads maiores que o padrão do Express;
- evita erro prematuro de payload muito grande em operações controladas.

Risco:

- limites altos aumentam consumo de memória se a API receber abuso de requisições grandes;
- o risco é mitigado parcialmente por rate limit global e validações específicas de upload.

### 3. Limite de payload URL encoded

```ts
app.use(urlencoded({ extended: true, limit: '20mb' }));
```

Permite payloads `application/x-www-form-urlencoded` maiores.

O parâmetro `extended: true` permite parsing de objetos mais complexos.

### 4. Headers de segurança

```ts
app.use(helmet());
```

Aplica headers HTTP de segurança.

Objetivo:

- reduzir exposição de informações da stack;
- mitigar ataques comuns envolvendo headers inseguros;
- aplicar padrões seguros para browsers.

### 5. Compressão HTTP

```ts
app.use(compression());
```

Habilita compressão GZIP/deflate para reduzir tamanho das respostas.

Impacto:

- melhora performance percebida no frontend;
- reduz tráfego de rede;
- útil para respostas JSON grandes, como listagens e relatórios.

### 6. Prefixo global

```ts
app.setGlobalPrefix('api');
```

Define que todas as rotas da aplicação serão expostas sob `/api`.

Exemplos:

```txt
/auth/login       → /api/auth/login
/users            → /api/users
/comunicados      → /api/comunicados
/site-config      → /api/site-config
```

### 7. CORS

```ts
app.enableCors({
  origin: [
    'http://localhost:4200',
    'https://instituto-luizbraille.vercel.app',
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'Cache-Control',
    'Pragma',
    'Expires',
    'X-Requested-With',
  ],
});
```

Define quais origens podem consumir a API pelo navegador.

Origens permitidas:

- frontend local Angular em `http://localhost:4200`;
- frontend publicado em Vercel;
- URL configurável via `FRONTEND_URL`.

O uso de `.filter(Boolean)` remove valor indefinido quando `FRONTEND_URL` não está configurado.

### 8. Validação global

```ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);
```

Aplica validação global a DTOs.

Comportamento:

- `whitelist: true`: remove campos que não existem no DTO;
- `forbidNonWhitelisted: true`: rejeita payload com campos extras;
- `transform: true`: converte tipos automaticamente conforme DTO.

Impacto arquitetural:

- protege services contra dados inesperados;
- reduz risco de mass assignment;
- padroniza validação em toda API;
- obriga controllers a declararem contratos claros.

### 9. Swagger

```ts
setupSwagger(app);
```

Chama função utilitária que configura a documentação Swagger.

Responsabilidade da função externa:

- configurar título, descrição e versão;
- configurar autenticação Bearer se aplicável;
- expor documentação em `/docs`.

### 10. Inicialização do servidor

```ts
await app.listen(process.env.PORT || 3000);
```

Inicia o servidor HTTP na porta definida em ambiente ou na porta `3000`.

---

# 4. Dicionário Técnico

## Variáveis

| Nome | Tipo | Objetivo | Valor esperado | Impacto no sistema |
|---|---|---|---|---|
| `app` | `INestApplication` | Instância principal da aplicação NestJS | Objeto criado por `NestFactory.create` | Centraliza middlewares, pipes, Swagger e listener HTTP |
| `process.env.PORT` | `string | undefined` | Porta do servidor | Número em formato string | Define onde a API escuta requisições |
| `process.env.FRONTEND_URL` | `string | undefined` | Origem adicional permitida no CORS | URL do frontend | Permite deploy flexível sem alterar código |

## Funções e Métodos

### `bootstrap()`

| Item | Descrição |
|---|---|
| Objetivo | Inicializar e configurar a aplicação NestJS |
| Parâmetros | Nenhum |
| Retorno | `Promise<void>` |
| Exceções | Pode falhar se módulos globais, validação de ambiente ou porta estiverem inválidos |
| Dependências | `AppModule`, `setupSwagger`, Express middlewares, `ValidationPipe` |

### `NestFactory.create(AppModule)`

Cria a aplicação NestJS a partir do módulo raiz.

### `app.use(...)`

Registra middlewares Express globais.

### `app.setGlobalPrefix('api')`

Define prefixo global para todas as rotas.

### `app.enableCors(...)`

Configura CORS para consumo do frontend.

### `app.useGlobalPipes(...)`

Aplica validação global.

### `app.listen(...)`

Inicia o servidor HTTP.

## Classes

O arquivo não declara classes próprias. Ele consome classes e funções externas:

| Classe/Função | Origem | Uso |
|---|---|---|
| `NestFactory` | `@nestjs/core` | Criar aplicação NestJS |
| `AppModule` | `./app.module` | Módulo raiz |
| `ValidationPipe` | `@nestjs/common` | Validação global |
| `json` | `express` | Parser JSON |
| `urlencoded` | `express` | Parser URL encoded |
| `helmet` | `helmet` | Headers de segurança |
| `compression` | `compression` | Compressão HTTP |
| `setupSwagger` | `./common/config/swagger.config` | Configuração Swagger |

## Interfaces e Tipagens

O arquivo usa tipagem implícita do NestJS e Express. A tipagem principal é a instância retornada por `NestFactory.create`, equivalente a uma aplicação Nest (`INestApplication`).

---

# 5. Serviços e Integrações

## APIs

O `main.ts` não declara endpoints diretamente. Ele define o comportamento global de todos os endpoints.

Configurações globais aplicadas às APIs:

- prefixo `/api`;
- CORS;
- validação DTO;
- Swagger;
- middlewares Express;
- compressão;
- segurança HTTP.

## Banco de Dados

O arquivo não acessa o banco diretamente.

A conexão com banco é carregada indiretamente quando o `AppModule` importa o `PrismaModule` e o Nest inicializa os providers.

## Serviços Externos

O `main.ts` não chama diretamente serviços externos como Cloudinary ou PostgreSQL, mas prepara a aplicação para módulos que farão essas integrações.

---

# 6. Segurança e Qualidade

## Segurança

Medidas aplicadas no bootstrap:

### Helmet

Protege headers HTTP e reduz exposição de informações.

### CORS controlado

Somente origens conhecidas podem consumir a API via navegador.

### ValidationPipe global

Bloqueia campos extras e transforma tipos.

### Prefixo `/api`

Isola rotas backend e facilita proxy/reverse proxy.

### Limite de payload

Define limite explícito de `20mb` em JSON e URL encoded.

## Qualidade

O bootstrap é simples e centralizado. Isso facilita manutenção, pois configurações globais ficam em um único arquivo.

A separação `setupSwagger(app)` respeita responsabilidade única: o `main.ts` chama a configuração, mas os detalhes do Swagger ficam em arquivo próprio.

## Performance

A compressão HTTP melhora tráfego de rede.

O limite de payload evita que a aplicação aceite payloads ilimitados, mas ainda permite operações com documentos e imagens.

---

# 7. Regras de Negócio

Embora `main.ts` seja infraestrutura, ele impõe regras globais que afetam o negócio:

- todas as rotas de negócio devem estar em `/api`;
- requisições com campos extras nos DTOs são recusadas;
- frontend autorizado deve estar na lista de CORS;
- payloads acima de `20mb` não devem ser aceitos no parser global;
- documentação Swagger deve estar disponível em `/docs`;
- a porta padrão local é `3000`.

Essas regras garantem previsibilidade entre frontend, backend e ambiente de deploy.

---

# 8. Pontos de Atenção

## Riscos

- O limite global de `20mb` pode ser alto para rotas que não precisam receber payload grande.
- `console.log` no bootstrap é aceitável em desenvolvimento, mas em produção seria melhor usar logger estruturado.
- A URL fixa `https://instituto-luizbraille.vercel.app` está hardcoded no CORS; em ambientes múltiplos, convém centralizar em variável de ambiente.
- `credentials: true` exige cuidado para não permitir origens amplas.

## Débitos Técnicos

- Avaliar substituição de `console.log` por `Logger` do NestJS.
- Avaliar CORS 100% configurado por ambiente.
- Avaliar limites de payload mais restritos por rota em vez de limite global alto.

## Melhorias Futuras

- Adicionar shutdown hooks explícitos se necessário.
- Adicionar logger estruturado no bootstrap.
- Externalizar lista completa de CORS para variável de ambiente.
- Documentar estratégia de reverse proxy e trust proxy caso a API rode atrás de proxy.

---

# 9. Relação com Outros Módulos

| Módulo | Relação |
|---|---|
| `AppModule` | É passado para `NestFactory.create()` |
| `swagger.config.ts` | Configura documentação Swagger chamada no bootstrap |
| `auth` | É afetado por CORS, prefixo e validação global |
| `upload` | É afetado pelo limite global de payload |
| `common` | Pipes e configurações globais impactam todos os módulos |
| Todos os controllers | Recebem prefixo `/api` e validação global |

---

# 10. Resumo Técnico Final

O `main.ts` é o ponto de entrada operacional da Braille API. Ele não contém regra de negócio específica, mas define políticas globais que afetam toda a aplicação.

## Função do módulo

Inicializar o NestJS e configurar a camada HTTP antes da entrada nos controllers.

## Importância no sistema

Alta. Uma configuração incorreta neste arquivo afeta todas as rotas da API.

## Nível de criticidade

Alto, pois envolve segurança HTTP, CORS, validação global, prefixo de rotas e inicialização da aplicação.

## Complexidade

Baixa/Média. O código é pequeno, mas tem impacto transversal alto.

## Principais integrações

- NestJS;
- Express;
- Helmet;
- Compression;
- Swagger;
- AppModule.
