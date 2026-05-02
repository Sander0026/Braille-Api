# Guia de Desenvolvedores — Braille API

---

## 1. Objetivo

Esta pasta concentra a documentação técnica profissional da **Braille API**, escrita para ajudar novos desenvolvedores a entenderem rapidamente a arquitetura, os módulos, os fluxos de negócio, as integrações, as variáveis de ambiente, os métodos principais e as decisões técnicas adotadas no backend.

A documentação foi criada com foco em **backend NestJS**, cobrindo apenas informações técnicas não sigilosas. Nenhum segredo, token, senha real, URL privada de banco ou credencial de serviço externo deve ser documentado aqui.

---

## 2. Escopo da documentação

Esta documentação cobre:

- arquitetura geral do backend;
- metodologia e padrões usados;
- estrutura de pastas;
- módulos NestJS;
- controllers, services, guards, interceptors, filters e pipes;
- rotas e permissões;
- banco de dados Prisma/PostgreSQL;
- regras de negócio por domínio;
- integrações externas;
- segurança;
- performance;
- operação e manutenção;
- dicionário técnico de variáveis, constantes, classes e métodos relevantes.

Esta documentação não cobre:

- valores reais de variáveis de ambiente;
- chaves privadas;
- senhas;
- tokens;
- dados reais de usuários ou alunos;
- URLs sensíveis de produção;
- credenciais de Cloudinary, banco ou JWT.

---

## 3. Como usar esta pasta

A leitura recomendada para um novo desenvolvedor é:

1. `01-arquitetura-metodologia.md`
2. `02-execucao-ambiente.md`
3. `03-modulos-rotas.md`
4. `04-banco-prisma.md`
5. `05-seguranca-auth-rbac-auditoria.md`
6. `06-regras-negocio-fluxos.md`
7. `07-dicionario-tecnico.md`
8. `08-integracoes-arquivos-certificados.md`
9. `09-qualidade-performance-operacao.md`
10. `10-onboarding-proximos-devs.md`

---

## 4. Mapa dos documentos

| Arquivo | Conteúdo |
|---|---|
| `01-arquitetura-metodologia.md` | Visão arquitetural, stack, camadas, metodologia e decisões técnicas. |
| `02-execucao-ambiente.md` | Scripts, variáveis de ambiente, execução local, build, migrations e seed. |
| `03-modulos-rotas.md` | Mapa de módulos, controllers, rotas, permissões e responsabilidades. |
| `04-banco-prisma.md` | Schema Prisma, entidades, relacionamentos, enums, índices e decisões de modelagem. |
| `05-seguranca-auth-rbac-auditoria.md` | JWT, refresh token, sessões, RBAC, CORS, Helmet, throttling, filtros e auditoria. |
| `06-regras-negocio-fluxos.md` | Regras de negócio por domínio e fluxos críticos. |
| `07-dicionario-tecnico.md` | Guia de consulta de variáveis, constantes, métodos, classes e por que existem. |
| `08-integracoes-arquivos-certificados.md` | Cloudinary, ExcelJS, PDF-lib, processamento de imagens e certificados. |
| `09-qualidade-performance-operacao.md` | Testes, logging, performance, cache, deploy, riscos e débitos técnicos. |
| `10-onboarding-proximos-devs.md` | Guia prático para entrada de novos devs e manutenção segura. |

---

## 5. Convenção de nomes usada no projeto

| Tipo | Convenção | Exemplo |
|---|---|---|
| Módulos NestJS | `NomeModule` | `AuthModule`, `UsersModule` |
| Controllers | `NomeController` | `AuthController`, `TurmasController` |
| Services | `NomeService` | `AuthService`, `UploadService` |
| DTOs de criação | `CreateNomeDto` | `CreateUserDto` |
| DTOs de atualização | `UpdateNomeDto` | `UpdateTurmaDto` |
| DTOs de consulta | `QueryNomeDto` | `QueryBeneficiaryDto` |
| Guards | `NomeGuard` | `AuthGuard`, `RolesGuard` |
| Interceptors | `NomeInterceptor` | `AuditInterceptor` |
| Filters | `NomeFilter` | `PrismaExceptionFilter` |
| Helpers | `nome.helper.ts` | `audit.helper.ts` |
| Decorators | `nome.decorator.ts` | `skip-audit.decorator.ts` |

---

## 6. Política de documentação segura

Ao atualizar estes documentos:

- documente o nome da variável, mas não o valor real;
- documente o objetivo de um segredo, mas nunca copie o segredo;
- documente integrações externas, mas sem credenciais;
- use exemplos fictícios para payloads;
- evite dados pessoais reais;
- não inclua prints de produção com dados sensíveis;
- ao citar arquivos, prefira caminhos relativos do repositório.

---

## 7. Resumo executivo

A Braille API é um backend modular em NestJS com Prisma/PostgreSQL, JWT, RBAC, auditoria, Cloudinary, geração de certificados, importação/exportação Excel e controle acadêmico de turmas e frequências.

A metodologia predominante é uma combinação de **arquitetura modular**, **camada de serviço**, **DTO validation**, **RBAC**, **soft delete**, **transações com Prisma**, **auditoria transversal** e **segurança por configuração global**.
