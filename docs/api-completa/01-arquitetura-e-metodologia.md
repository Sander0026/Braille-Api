# 01 — Arquitetura e Metodologia da Braille API

---

## 1. Visão Geral

A Braille API é uma aplicação backend construída com **NestJS**, **TypeScript**, **Prisma ORM** e **PostgreSQL**. A arquitetura segue uma separação modular por domínio, onde cada área funcional do sistema possui seu próprio módulo, controller, service, DTOs e, quando necessário, entidades auxiliares.

O backend atende a um sistema institucional com foco em gestão de alunos/beneficiários, funcionários, turmas, frequência, documentos médicos, certificados, comunicados, contatos, dashboard, uploads e auditoria.

---

## 2. Metodologia Arquitetural

A API adota uma metodologia baseada em camadas, com inspiração em boas práticas de **Clean Architecture**, **Service Layer**, **SOLID** e **Domain-Oriented Modularization**.

A estrutura prática do projeto é:

```txt
src/
  main.ts
  app.module.ts
  auth/
  users/
  beneficiaries/
  turmas/
  frequencias/
  atestados/
  laudos/
  upload/
  certificados/
  apoiadores/
  comunicados/
  contatos/
  dashboard/
  site-config/
  audit-log/
  prisma/
  common/
```

Cada módulo representa um contexto funcional. A API evita concentrar toda a regra em um único service global, facilitando manutenção, testes, evolução e leitura por novos devs.

---

## 3. Camadas da Aplicação

### 3.1 Bootstrap

Arquivo principal: `src/main.ts`.

Responsabilidades:

- criar a aplicação NestJS;
- configurar limite de payload;
- ativar Helmet;
- ativar compressão;
- configurar CORS;
- definir prefixo global `/api`;
- ativar validação global;
- configurar Swagger;
- iniciar servidor HTTP.

### 3.2 AppModule

Arquivo principal: `src/app.module.ts`.

Responsabilidades:

- carregar variáveis de ambiente;
- registrar cache global;
- registrar throttling global;
- habilitar scheduler;
- importar módulos de domínio;
- registrar guards, interceptors e filters globais.

### 3.3 Controller Layer

Controllers ficam responsáveis por:

- declarar rotas HTTP;
- aplicar `@UseGuards`;
- aplicar `@Roles`;
- receber parâmetros, query e body;
- documentar endpoints com Swagger;
- delegar execução ao service.

Controllers não devem conter regra de negócio complexa.

### 3.4 Service Layer

Services concentram:

- regras de negócio;
- validações específicas do domínio;
- chamadas ao Prisma;
- transações;
- auditoria manual quando necessário;
- integração com Cloudinary, PDF, Excel e outros serviços.

Essa camada é a principal referência para entender o comportamento real do sistema.

### 3.5 Persistence Layer

Persistência é feita com Prisma:

```txt
prisma/schema.prisma
src/prisma/prisma.service.ts
```

O `PrismaService` gerencia conexão, desconexão, logs e keep-alive.

### 3.6 Common Layer

A pasta `src/common` contém recursos transversais:

- filtros globais;
- pipes;
- decorators;
- helpers;
- interfaces;
- DTOs comuns;
- configuração de Swagger;
- validação de ambiente.

---

## 4. Fluxo de Requisição

Fluxo padrão:

```txt
Cliente HTTP
  ↓
NestJS middleware global
  ↓
Helmet / Compression / CORS / JSON parser
  ↓
Global prefix /api
  ↓
ValidationPipe
  ↓
AuthGuard
  ↓
RolesGuard
  ↓
Controller
  ↓
Service
  ↓
PrismaService
  ↓
PostgreSQL
  ↓
Service monta resposta
  ↓
AuditInterceptor ou auditoria manual
  ↓
Resposta HTTP
```

---

## 5. Padrões Identificados

| Padrão | Uso no projeto | Motivo |
|---|---|---|
| Modular Architecture | Um módulo por domínio | Facilita manutenção e evolução. |
| Service Layer | Services concentram regras | Evita controller pesado. |
| Dependency Injection | Nest injeta dependências | Reduz acoplamento e facilita testes. |
| DTO Validation | `class-validator` + `ValidationPipe` | Protege entrada da API. |
| RBAC | `@Roles`, `RolesGuard` | Controla acesso por perfil. |
| Repository via ORM | Prisma acessado pelos services | Garante tipagem e abstrai SQL. |
| Soft Delete | `statusAtivo`, `excluido`, `excluidoEm` | Preserva histórico e evita perda de dados. |
| Audit Trail | `AuditLog`, interceptor e services | Rastreabilidade institucional. |
| Transaction Script | `prisma.$transaction` | Garante atomicidade em fluxos críticos. |
| Cache | `CacheModule`, `CacheInterceptor` | Reduz carga em leituras frequentes. |

---

## 6. Decisões Técnicas Importantes

### 6.1 NestJS

Escolhido por fornecer arquitetura modular, injeção de dependência, decorators, integração com Swagger, guards, pipes, interceptors e filters.

### 6.2 Prisma

Escolhido para tipagem forte, migrations, schema centralizado e queries legíveis.

### 6.3 PostgreSQL

Escolhido por robustez relacional, integridade, suporte a índices e adequação a dados institucionais.

### 6.4 JWT + Refresh Token

JWT permite access token curto e stateless. Refresh token persistido em sessão permite revogação, rotação e controle real de sessões.

### 6.5 bcrypt

Usado para hash de senha e refresh token secreto. Foi escolhido por ser biblioteca madura e resistente a brute force quando configurada com custo adequado.

### 6.6 Cloudinary

Usado para armazenar documentos e imagens sem manter arquivos no servidor da API. Reduz complexidade de storage local.

### 6.7 Auditoria

A auditoria é essencial porque o sistema manipula dados sensíveis, documentos médicos, alunos e ações administrativas.

---

## 7. Metodologia de Evolução Recomendada

Antes de alterar qualquer módulo:

1. Leia o controller.
2. Leia o service.
3. Leia os DTOs.
4. Leia o modelo Prisma relacionado.
5. Verifique guards e roles.
6. Verifique se há auditoria manual.
7. Verifique se há cache.
8. Verifique se a alteração exige migration.
9. Atualize esta documentação.
10. Crie ou atualize testes.

---

## 8. Regra de Ouro

A regra de negócio deve ficar no **service**, a autorização no **controller/guard**, a validação estrutural no **DTO**, e a integridade persistente no **Prisma schema**.
