# 05 — Swagger / OpenAPI (`swagger.config.ts`)

---

# 1. Visão Geral

## Objetivo

Este documento descreve o arquivo:

```txt
src/common/config/swagger.config.ts
```

Esse arquivo centraliza a configuração da documentação Swagger/OpenAPI da Braille API.

O Swagger permite visualizar, testar e consultar os endpoints HTTP da aplicação por meio de uma interface web, facilitando desenvolvimento, integração frontend/backend, validação de contratos e onboarding técnico.

## Responsabilidade

O arquivo `swagger.config.ts` é responsável por:

- criar a configuração OpenAPI da aplicação;
- definir título, descrição e versão da API;
- habilitar autenticação Bearer no Swagger;
- gerar o documento OpenAPI com base nos controllers e decorators;
- expor a interface Swagger em `/docs`.

## Fluxo de Funcionamento

Fluxo executado a partir do `main.ts`:

```txt
main.ts
  ↓
setupSwagger(app)
  ↓
new DocumentBuilder()
  ↓
setTitle(...)
  ↓
setDescription(...)
  ↓
setVersion(...)
  ↓
addTag(...)
  ↓
addBearerAuth()
  ↓
build()
  ↓
SwaggerModule.createDocument(app, config)
  ↓
SwaggerModule.setup('docs', app, document)
  ↓
Swagger disponível em /docs
```

---

# 2. Arquitetura e Metodologias

## Padrões Arquiteturais Identificados

- **Configuration Function Pattern**: configuração encapsulada em função `setupSwagger()`.
- **OpenAPI Documentation Pattern**: geração de contrato HTTP documentável.
- **Separation of Concerns**: configuração Swagger separada do `main.ts`.
- **Security Documentation Pattern**: autenticação Bearer declarada no documento OpenAPI.
- **Decorator-driven Documentation**: controllers e DTOs anotados com decorators Swagger complementam o documento gerado.

## Justificativa Técnica

Separar a configuração Swagger em um arquivo próprio evita que o `main.ts` acumule detalhes de documentação. O bootstrap apenas chama `setupSwagger(app)`, enquanto a definição de título, versão, tags e autenticação fica isolada.

Essa decisão melhora:

- organização do bootstrap;
- manutenção da documentação OpenAPI;
- centralização da configuração Swagger;
- facilidade de evolução das tags e metadados;
- clareza para integração com frontend e QA.

---

# 3. Fluxo Interno do Código

## Fluxo de Execução

### 1. Importação do Swagger

```ts
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
```

Importa as classes necessárias para montar e expor a documentação OpenAPI.

### 2. Importação da aplicação NestJS

```ts
import { INestApplication } from '@nestjs/common';
```

Define o tipo do parâmetro recebido pela função `setupSwagger()`.

### 3. Declaração da função principal

```ts
export function setupSwagger(app: INestApplication): void
```

A função recebe a instância da aplicação NestJS já criada pelo `main.ts`.

Ela não retorna valor, pois sua função é aplicar configuração na aplicação recebida.

### 4. Construção da configuração OpenAPI

```ts
const config = new DocumentBuilder()
  .setTitle('Braillix API')
  .setDescription('API de gestão para instituição de deficientes visuais')
  .setVersion('1.0')
  .addTag('beneficiaries')
  .addBearerAuth()
  .build();
```

Esse bloco define os metadados principais da documentação.

#### `setTitle('Braillix API')`

Define o nome exibido no Swagger.

#### `setDescription(...)`

Define a descrição geral da API.

#### `setVersion('1.0')`

Define a versão da documentação/API.

#### `addTag('beneficiaries')`

Adiciona tag inicial ao documento.

#### `addBearerAuth()`

Declara suporte a autenticação Bearer Token no Swagger.

Isso permite que usuários da interface Swagger informem um JWT para testar rotas protegidas.

### 5. Criação do documento OpenAPI

```ts
const document = SwaggerModule.createDocument(app, config);
```

Gera o documento OpenAPI a partir:

- da instância da aplicação;
- da configuração criada pelo `DocumentBuilder`;
- dos decorators presentes nos controllers e DTOs.

### 6. Exposição da interface Swagger

```ts
SwaggerModule.setup('docs', app, document);
```

Exibe a interface Swagger no caminho:

```txt
/docs
```

Como o Swagger é configurado diretamente em `main.ts` antes de `app.listen()`, ele fica disponível quando a aplicação inicia.

## Dependências Internas

| Dependência | Uso |
|---|---|
| `main.ts` | Chama `setupSwagger(app)` |
| Controllers da API | Fornecem decorators `@ApiTags`, `@ApiOperation`, `@ApiBearerAuth` etc. |
| DTOs | Podem fornecer decorators `@ApiProperty` para contratos de payload |

## Dependências Externas

| Biblioteca | Uso |
|---|---|
| `@nestjs/swagger` | Geração e exposição OpenAPI |
| `@nestjs/common` | Tipo `INestApplication` |

---

# 4. Dicionário Técnico

## Variáveis

| Nome | Tipo | Objetivo | Valor esperado | Impacto no sistema |
|---|---|---|---|---|
| `app` | `INestApplication` | Instância NestJS recebida do bootstrap | Aplicação criada em `main.ts` | Permite gerar e registrar Swagger |
| `config` | Objeto OpenAPI builder | Configuração Swagger gerada por `DocumentBuilder` | Configuração construída | Define título, descrição, versão, tags e autenticação |
| `document` | Documento OpenAPI | Representação da API gerada pelo Swagger | Objeto OpenAPI | Usado para expor `/docs` |

## Funções e Métodos

### `setupSwagger(app)`

| Item | Descrição |
|---|---|
| Objetivo | Configurar Swagger/OpenAPI na aplicação NestJS |
| Parâmetros | `app: INestApplication` |
| Retorno | `void` |
| Exceções | Pode falhar se a geração do documento encontrar metadados inválidos |
| Dependências | `DocumentBuilder`, `SwaggerModule` |

### `new DocumentBuilder()`

Cria um builder fluente para configurar metadados OpenAPI.

### `setTitle(title)`

Define o título da documentação.

### `setDescription(description)`

Define a descrição textual da API.

### `setVersion(version)`

Define a versão do documento.

### `addTag(tag)`

Adiciona uma tag ao agrupamento da documentação.

### `addBearerAuth()`

Declara esquema de autenticação Bearer.

### `SwaggerModule.createDocument(app, config)`

Gera o documento OpenAPI final.

### `SwaggerModule.setup(path, app, document)`

Publica a interface Swagger no caminho informado.

## Classes

| Classe | Origem | Responsabilidade |
|---|---|---|
| `DocumentBuilder` | `@nestjs/swagger` | Construir configuração OpenAPI |
| `SwaggerModule` | `@nestjs/swagger` | Gerar e expor documentação Swagger |

## Interfaces e Tipagens

### `INestApplication`

Representa a instância da aplicação NestJS.

É usada para garantir que `setupSwagger()` receba um objeto compatível com a aplicação criada no bootstrap.

---

# 5. Serviços e Integrações

## APIs

O arquivo não cria endpoints de negócio, mas cria a interface técnica de documentação da API.

Endpoint de documentação:

```txt
GET /docs
```

Observação: como o Swagger é registrado pelo `SwaggerModule.setup('docs', ...)`, ele não usa o prefixo global `/api` da mesma forma que os controllers comuns.

## Banco de Dados

O Swagger não acessa banco de dados.

Ele apenas reflete metadados dos controllers, DTOs e decorators.

## Serviços Externos

Não há integração externa além da própria biblioteca `@nestjs/swagger`.

---

# 6. Segurança e Qualidade

## Segurança

### Bearer Auth documentado

O uso de:

```ts
.addBearerAuth()
```

permite que o Swagger represente rotas protegidas por JWT.

Isso é importante porque a API usa autenticação Bearer nas rotas protegidas.

### Exposição da documentação

A documentação em `/docs` é útil para desenvolvimento, mas deve ser avaliada em produção.

Risco:

- expor metadados de rotas, payloads e contratos pode facilitar reconhecimento por atacantes.

Possíveis estratégias futuras:

- proteger `/docs` em produção;
- desabilitar Swagger em produção;
- permitir apenas em ambientes internos;
- exigir autenticação para documentação.

## Qualidade

Swagger melhora qualidade de integração porque:

- deixa endpoints visíveis;
- documenta payloads quando DTOs possuem decorators;
- permite testar rotas;
- reduz ambiguidade entre frontend e backend;
- ajuda QA e manutenção.

## Performance

A geração do documento ocorre no startup. O impacto em runtime é baixo.

A interface `/docs` consome recursos apenas quando acessada.

---

# 7. Regras de Negócio

O arquivo não possui regras de negócio institucionais.

Entretanto, impõe regras técnicas importantes:

- a API possui documentação OpenAPI oficial;
- a documentação declara autenticação Bearer;
- a versão documentada é `1.0`;
- o Swagger é publicado em `/docs`;
- os controllers devem usar decorators Swagger para melhorar completude da documentação.

---

# 8. Pontos de Atenção

## Riscos

- A documentação Swagger está exposta em `/docs` sem proteção explícita neste arquivo.
- Apenas a tag `beneficiaries` é adicionada globalmente, embora existam muitos módulos.
- O título está como `Braillix API`, enquanto o projeto é referenciado como Braille API em outros contextos. Isso pode indicar divergência de nomenclatura.
- Se DTOs não tiverem `@ApiProperty`, a documentação de payloads pode ficar incompleta.

## Débitos Técnicos

- Revisar nomenclatura do título para padronizar com o nome oficial do sistema.
- Adicionar tags globais para os principais módulos ou confiar totalmente em `@ApiTags` dos controllers.
- Avaliar proteção ou desativação do Swagger em produção.
- Garantir que todos os DTOs relevantes usem `@ApiProperty` ou `@ApiPropertyOptional`.

## Melhorias Futuras

- Configurar `.addBearerAuth()` com nome explícito de security scheme, se necessário.
- Adicionar informações de contato/licença se houver exigência institucional.
- Adicionar servidores (`addServer`) para ambientes local, homologação e produção.
- Gerar arquivo OpenAPI JSON para integração com ferramentas externas.

---

# 9. Relação com Outros Módulos

| Módulo/Arquivo | Relação |
|---|---|
| `main.ts` | Chama `setupSwagger(app)` durante bootstrap |
| Controllers | Fornecem metadados como `@ApiTags`, `@ApiOperation`, `@ApiBearerAuth` |
| DTOs | Fornecem metadados de payload via `@ApiProperty` |
| `AuthModule` | Relaciona-se com Bearer Auth documentado |
| Frontend | Usa Swagger como referência de contratos |
| QA/Testes | Pode usar Swagger para validar endpoints manualmente |

---

# 10. Resumo Técnico Final

O arquivo `swagger.config.ts` centraliza a configuração OpenAPI da Braille API. Ele é simples, direto e cumpre o objetivo de expor documentação técnica em `/docs`.

## Função do módulo

Configurar e publicar Swagger/OpenAPI.

## Importância no sistema

Média/Alta. Não é necessário para a regra de negócio funcionar, mas é essencial para integração, manutenção, testes manuais e entendimento dos contratos HTTP.

## Nível de criticidade

Médio. Uma falha no Swagger não impede necessariamente a lógica de negócio, mas pode prejudicar integração e documentação.

## Complexidade

Baixa. O arquivo possui uma função única e poucas configurações.

## Principais integrações

- `@nestjs/swagger`;
- `main.ts`;
- controllers;
- DTOs;
- autenticação Bearer.

## Observações finais

A configuração atual está funcional e adequada para desenvolvimento. Para produção, recomenda-se avaliar proteção do endpoint `/docs`, padronizar o nome exibido e enriquecer a documentação com tags e metadados por módulo.
