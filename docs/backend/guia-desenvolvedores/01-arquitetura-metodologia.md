# 01 — Arquitetura e Metodologia da Braille API

---

## 1. Visão geral arquitetural

A Braille API é uma aplicação backend construída com **NestJS**, **TypeScript**, **Prisma ORM** e **PostgreSQL**. O projeto segue uma arquitetura modular, onde cada domínio de negócio possui seu próprio módulo, controller, service e DTOs.

A arquitetura prioriza:

- separação de responsabilidades;
- modularidade;
- validação de entrada por DTO;
- regras de negócio concentradas em services;
- autenticação JWT;
- autorização por papéis;
- auditoria de ações críticas;
- persistência tipada via Prisma;
- soft delete para preservar histórico;
- transações em operações críticas;
- documentação via Swagger;
- integração com serviços externos sem acoplamento direto nos controllers.

---

## 2. Stack principal

| Camada | Tecnologia | Motivo da escolha |
|---|---|---|
| Framework HTTP | NestJS | Estrutura modular, DI nativa, decorators, guards, interceptors e padrão enterprise. |
| Linguagem | TypeScript | Tipagem estática, melhor manutenção e integração com Nest/Prisma. |
| ORM | Prisma | Schema centralizado, migrations, tipagem forte e client gerado automaticamente. |
| Banco | PostgreSQL | Banco relacional robusto, suporte a índices, constraints e integridade. |
| Auth | JWT + bcrypt | JWT para access token stateless e bcrypt para hashes de senha/tokens. |
| Upload | Cloudinary | Armazenamento e otimização de imagens/PDFs sem manter arquivos locais. |
| Documentação API | Swagger/OpenAPI | Facilita contrato entre frontend/backend e testes manuais. |
| Importação/Exportação | ExcelJS | Leitura e geração de planilhas `.xlsx`. |
| PDF | PDF-lib | Geração programática de certificados. |
| Cache | cache-manager | Cache em memória para leituras frequentes. |
| Rate limit | NestJS Throttler | Proteção contra abuso e força bruta. |

---

## 3. Metodologia adotada

### 3.1 Arquitetura modular

Cada domínio fica isolado em uma pasta própria dentro de `src/`.

Exemplos:

```txt
src/auth/
src/users/
src/beneficiaries/
src/turmas/
src/frequencias/
src/upload/
src/certificados/
src/audit-log/
```

Essa decisão facilita:

- manutenção por domínio;
- onboarding de novos desenvolvedores;
- separação de regras de negócio;
- testes isolados;
- evolução incremental sem alterar o sistema inteiro.

### 3.2 Controller fino

Controllers devem:

- declarar rotas;
- aplicar guards e roles;
- receber DTOs;
- extrair parâmetros;
- delegar processamento ao service.

Controllers não devem conter regra de negócio pesada.

### 3.3 Service como camada de regra de negócio

Services concentram:

- validações de negócio;
- chamadas ao Prisma;
- transações;
- integrações externas;
- auditoria manual quando necessário;
- tratamento de estados do domínio.

Exemplo de responsabilidade correta:

```txt
TurmasController.addAluno() recebe turmaId e alunoId.
TurmasService.addAluno() valida aluno, turma, capacidade, conflito de horário e grava matrícula.
```

### 3.4 DTO validation

DTOs são usados para validar dados de entrada com `class-validator` e transformar tipos com `class-transformer`.

O `ValidationPipe` global usa:

- `whitelist: true` — remove campos que não existem no DTO;
- `forbidNonWhitelisted: true` — rejeita campos extras;
- `transform: true` — converte tipos quando aplicável.

Essa estratégia reduz risco de mass assignment e payload inesperado.

### 3.5 RBAC

O sistema usa RBAC com roles do Prisma:

```txt
ADMIN
SECRETARIA
PROFESSOR
COMUNICACAO
```

A autorização é aplicada por:

- `AuthGuard` — valida JWT;
- `RolesGuard` — verifica papéis permitidos;
- `@Roles(...)` — declara permissões por rota.

### 3.6 Soft delete

Em vez de remover registros importantes fisicamente, o projeto usa campos como:

- `statusAtivo`;
- `excluido`;
- `excluidoEm`;
- `excluidoPorId`.

Esse padrão preserva histórico, evita perda acidental de dados e mantém rastreabilidade.

### 3.7 Auditoria

A auditoria acontece de duas formas:

1. Globalmente pelo `AuditInterceptor`, para mutações HTTP comuns.
2. Manualmente nos services, quando a operação tem regra especial, precisa de `oldValue`, `newValue` ou usa `@SkipAudit`.

Essa decisão evita logs genéricos demais e melhora a qualidade do histórico.

### 3.8 Transações Prisma

Operações que alteram múltiplas tabelas usam `prisma.$transaction`.

Exemplos:

- criar atestado e justificar faltas;
- remover atestado e reverter faltas;
- atualizar status de turma e encerrar matrículas;
- salvar frequência em lote.

A motivação é garantir atomicidade: ou tudo é concluído, ou nada é persistido.

---

## 4. Camadas principais

```txt
Request HTTP
  ↓
Middleware Express / Nest
  ↓
Guards
  ↓
Pipes / DTO Validation
  ↓
Controller
  ↓
Service
  ↓
PrismaService
  ↓
PostgreSQL
  ↓
Response
```

Cross-cutting concerns:

```txt
AuditInterceptor
PrismaExceptionFilter
PrismaValidationFilter
CacheInterceptor
ThrottlerGuard
```

---

## 5. Estrutura de responsabilidade

| Camada | Pode fazer | Não deve fazer |
|---|---|---|
| Controller | Rotas, guards, parâmetros, DTOs | Regra de negócio complexa, queries diretas extensas |
| Service | Regras, Prisma, transações, integrações | Formatar documentação HTTP detalhada |
| DTO | Validar contrato de entrada | Executar regra de negócio com banco |
| Entity | Representar contrato/schema de resposta | Persistir diretamente |
| Guard | Autorizar/autenticar | Executar regra de negócio de domínio |
| Interceptor | Auditoria, transformação, logging | Decidir regra específica de aluno/turma |
| Filter | Tratar exceções | Corrigir dados inválidos |
| Helper | Funções reutilizáveis puras | Acessar banco sem necessidade clara |

---

## 6. Decisões técnicas importantes

### 6.1 Por que NestJS?

NestJS foi escolhido por fornecer uma base organizada para APIs grandes, com módulos, injeção de dependência, decorators, guards, interceptors e integração natural com Swagger. Isso reduz improviso arquitetural e padroniza o crescimento do backend.

### 6.2 Por que Prisma?

Prisma centraliza o modelo de dados em `schema.prisma`, gera client tipado e facilita migrations. Isso reduz erros de SQL manual e melhora a produtividade ao acessar entidades relacionadas.

### 6.3 Por que JWT com refresh token?

O access token JWT permite autenticação stateless e rápida. O refresh token persistido em `UserSession` permite controle de sessão, logout, revogação e rotação segura.

### 6.4 Por que Cloudinary?

A API não precisa armazenar arquivos localmente. O Cloudinary fornece URLs, otimização de imagens e armazenamento externo. Isso simplifica deploy em ambientes serverless ou containers efêmeros.

### 6.5 Por que auditoria manual em alguns services?

Algumas operações são complexas e precisam registrar contexto rico, como antes/depois, autor, IP e resultado de transações. Nesses casos, a auditoria automática poderia ser insuficiente.

### 6.6 Por que horários em minutos?

A grade horária usa minutos desde meia-noite para evitar problemas de timezone e facilitar comparação de sobreposição.

Exemplo:

```txt
14:00 = 840
16:00 = 960
```

Isso permite verificar colisão com:

```txt
inicioA < fimB && inicioB < fimA
```

---

## 7. Padrões de nomenclatura por domínio

| Domínio | Pasta | Entidade principal | Observação |
|---|---|---|---|
| Autenticação | `auth` | `User`, `UserSession` | Login, JWT, refresh e perfil. |
| Usuários | `users` | `User` | Funcionários/staff. |
| Beneficiários | `beneficiaries` | `Aluno` | Alunos/beneficiários. |
| Turmas | `turmas` | `Turma`, `MatriculaOficina`, `GradeHoraria` | Oficinas e matrículas. |
| Frequências | `frequencias` | `Frequencia` | Chamadas, diário e relatórios. |
| Atestados | `atestados` | `Atestado` | Justificativas de falta. |
| Laudos | `laudos` | `LaudoMedico` | Histórico médico. |
| Upload | `upload` | Cloudinary | Arquivos externos. |
| Certificados | `certificados` | `ModeloCertificado`, `CertificadoEmitido` | Modelos, PDFs e validação pública. |
| Auditoria | `audit-log` | `AuditLog` | Logs imutáveis de ações. |

---

## 8. Fluxo de uma rota típica

Exemplo: cadastro de aluno.

```txt
POST /api/beneficiaries
  ↓
AuthGuard valida JWT
  ↓
RolesGuard verifica ADMIN ou SECRETARIA
  ↓
ValidationPipe valida CreateBeneficiaryDto
  ↓
BeneficiariesController.create()
  ↓
BeneficiariesService.create()
  ↓
Verifica CPF/RG duplicado
  ↓
Gera matrícula do aluno
  ↓
Cria Aluno no PostgreSQL via Prisma
  ↓
Registra auditoria
  ↓
Retorna aluno criado
```

---

## 9. Critérios para novos módulos

Ao criar novo módulo:

1. Criar pasta em `src/<dominio>`.
2. Criar `<dominio>.module.ts`.
3. Criar `<dominio>.controller.ts`.
4. Criar `<dominio>.service.ts`.
5. Criar `dto/` com DTOs de entrada e consulta.
6. Criar `entities/` se houver contrato de resposta documentável.
7. Registrar módulo no `AppModule`.
8. Aplicar `AuthGuard` e `RolesGuard` se necessário.
9. Usar `@SkipAudit` apenas quando o service auditar manualmente.
10. Criar testes `.spec.ts`.
11. Atualizar esta documentação.

---

## 10. Resumo técnico

A metodologia do backend combina arquitetura modular, controllers finos, services ricos em regra de negócio, DTO validation, RBAC, soft delete, auditoria, transações e integrações encapsuladas. Essa abordagem foi escolhida para manter o sistema previsível, seguro, testável e fácil de evoluir por novos desenvolvedores.
