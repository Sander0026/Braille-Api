# 08 — Prisma Schema Geral (`prisma/schema.prisma`)

---

# 1. Visão Geral

## Objetivo

Este documento descreve a visão geral do arquivo:

```txt
prisma/schema.prisma
```

O `schema.prisma` é o contrato central de persistência da Braille API. Ele define:

- generators Prisma;
- datasource PostgreSQL;
- enums de domínio;
- models/tabelas;
- relacionamentos;
- chaves primárias;
- chaves únicas;
- índices;
- campos legados;
- decisões estruturais de modelagem.

Este documento tem escopo macro. A documentação detalhada campo a campo de cada entidade será feita em arquivos próprios da série `82-db-*` até `99-db-*`.

## Responsabilidade

O schema Prisma é responsável por:

- representar o modelo relacional da aplicação;
- gerar o Prisma Client tipado;
- orientar migrations;
- padronizar enums de domínio;
- definir relações entre entidades;
- garantir constraints como `@id`, `@unique`, `@@unique` e `@@index`;
- servir como fonte de verdade entre banco, services e regras de negócio.

## Fluxo de Funcionamento

Fluxo técnico:

```txt
schema.prisma
  ↓
prisma generate
  ↓
Prisma Client tipado
  ↓
PrismaService
  ↓
Services de domínio
  ↓
Controllers e regras de negócio
```

Fluxo de evolução do banco:

```txt
Alteração no schema.prisma
  ↓
npm run db:migrate:dev
  ↓
Nova migration em prisma/migrations
  ↓
npm run db:migrate:deploy em produção/homologação
  ↓
npm run db:generate
```

---

# 2. Arquitetura e Metodologias

## Padrões Arquiteturais Identificados

- **ORM Schema as Source of Truth**: o schema Prisma centraliza o modelo de dados.
- **Relational Domain Modeling**: entidades conectadas por relações explícitas.
- **Enum-driven Domain Rules**: estados e classificações críticas usam enums.
- **Soft Delete / Logical Status**: vários models usam `statusAtivo`, `excluido`, `ativo` ou campos de exclusão lógica.
- **Audit Trail Modeling**: `AuditLog` registra ações críticas de forma imutável.
- **Session Table Pattern**: `UserSession` controla refresh token por sessão.
- **CMS Key-Value Pattern**: `SiteConfig` e `ConteudoSecao` armazenam conteúdo flexível por chave.
- **Document Metadata Pattern**: laudos, atestados, certificados e termos armazenam URLs externas e metadados.
- **Many-to-one / One-to-many Modeling**: relações de aluno, turma, frequência, certificado e apoiadores seguem estrutura relacional clara.

## Justificativa Técnica

O sistema lida com dados administrativos, acadêmicos, pessoais, documentais e públicos. Um banco relacional com Prisma é adequado porque:

- garante integridade entre entidades;
- permite consultas tipadas;
- facilita migrations versionadas;
- permite índices explícitos;
- suporta relacionamentos ricos;
- melhora rastreabilidade de regras acadêmicas e documentais.

A escolha por enums evita strings soltas em campos críticos como `Role`, `TurmaStatus`, `StatusFrequencia`, `TipoCertificado` e categorias de comunicado.

A modelagem com UUID na maioria das entidades facilita criação distribuída de registros, evita exposição de IDs sequenciais e padroniza referências entre módulos.

---

# 3. Fluxo Interno do Código

## Fluxo de Execução

### 1. Generator do Prisma Client

```prisma
generator client {
  provider = "prisma-client-js"
}
```

Responsável por gerar o Prisma Client usado em runtime por `PrismaService`.

Impacto:

- cria métodos tipados para cada model;
- gera tipos TypeScript;
- viabiliza autocomplete e validação em tempo de compilação.

### 2. Generator ERD

```prisma
generator erd {
  provider = "prisma-erd-generator"
  output   = "../v1-erd.svg"
  theme    = "neutral"
}
```

Responsável por gerar diagrama ERD do banco.

Impacto:

- melhora visualização de relações;
- auxilia documentação;
- ajuda onboarding técnico.

### 3. Datasource PostgreSQL

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

Define PostgreSQL como banco principal.

Variáveis:

- `DATABASE_URL`: conexão principal;
- `DIRECT_URL`: conexão direta, útil em migrations e ambientes com pooler.

### 4. Enums

Enums padronizam valores permitidos.

Lista de enums:

- `Role`;
- `MatriculaStatus`;
- `DiaSemana`;
- `TurmaStatus`;
- `TipoDeficiencia`;
- `CausaDeficiencia`;
- `PreferenciaAcessibilidade`;
- `CategoriaComunicado`;
- `CorRaca`;
- `StatusFrequencia`;
- `AuditAcao`;
- `TipoApoiador`;
- `TipoCertificado`.

### 5. Models principais

O schema define os seguintes models:

| Model | Domínio |
|---|---|
| `User` | Usuários internos/staff |
| `UserSession` | Sessões e refresh tokens |
| `Aluno` | Beneficiários/alunos |
| `Turma` | Oficinas/turmas |
| `MatriculaOficina` | Matrículas de alunos em turmas |
| `GradeHoraria` | Horários estruturados de turmas |
| `Frequencia` | Chamadas e diário |
| `Atestado` | Justificativas de falta |
| `Comunicado` | Mural público |
| `MensagemContato` | Fale conosco |
| `LaudoMedico` | Histórico documental médico |
| `SiteConfig` | Configurações gerais do site |
| `ConteudoSecao` | Conteúdo editável da home |
| `AuditLog` | Auditoria central |
| `Apoiador` | Cadastro de apoiadores |
| `AcaoApoiador` | Ações/eventos de apoiadores |
| `ModeloCertificado` | Modelos de certificado |
| `CertificadoEmitido` | Certificados gerados |

### 6. Relacionamentos centrais

Relações principais:

```txt
User 1:N Turma
User 1:N Comunicado
User 1:N UserSession
Aluno 1:N MatriculaOficina
Aluno 1:N Frequencia
Aluno 1:N Atestado
Aluno 1:N LaudoMedico
Aluno 1:N CertificadoEmitido
Turma 1:N MatriculaOficina
Turma 1:N Frequencia
Turma 1:N GradeHoraria
Turma N:1 ModeloCertificado
Atestado 1:N Frequencia
Apoiador 1:N AcaoApoiador
Apoiador 1:N CertificadoEmitido
AcaoApoiador 1:N CertificadoEmitido
ModeloCertificado 1:N CertificadoEmitido
```

### 7. Índices

O schema usa `@@index` para acelerar consultas comuns.

Exemplos:

- `User`: status, role, CPF, email;
- `Aluno`: status, nome, matrícula, CPF, RG, email;
- `Turma`: status e professor;
- `Frequencia`: aluno, turma/data e justificativa;
- `Comunicado`: categoria, fixado/criadoEm e autor;
- `AuditLog`: entidade/registro, autor, data e ação;
- `CertificadoEmitido`: aluno, turma, apoiador, ação, código e modelo.

### 8. Constraints únicas

Exemplos:

- `User.username` único;
- `User.email` único opcional;
- `User.cpf` único opcional;
- `Aluno.matricula` único opcional;
- `Aluno.cpf` único opcional;
- `Aluno.rg` único opcional;
- `CertificadoEmitido.codigoValidacao` único;
- `Frequencia` possui `@@unique([dataAula, alunoId, turmaId])`.

---

# 4. Dicionário Técnico

## Variáveis e Estruturas

| Nome | Tipo | Objetivo | Valor esperado | Impacto no sistema |
|---|---|---|---|---|
| `DATABASE_URL` | env | Conexão principal PostgreSQL | URL PostgreSQL | Necessária para Prisma Client |
| `DIRECT_URL` | env | Conexão direta PostgreSQL | URL PostgreSQL | Usada em migrations/conexão direta |
| `provider = "postgresql"` | datasource | Define banco relacional | PostgreSQL | Determina dialeto SQL |
| `@id` | atributo Prisma | Chave primária | Campo único | Identifica registro |
| `@default(uuid())` | atributo Prisma | Geração de UUID | UUID | Padroniza IDs |
| `@default(now())` | atributo Prisma | Timestamp de criação | Data atual | Auditoria temporal |
| `@updatedAt` | atributo Prisma | Atualização automática | DateTime | Controle de edição |
| `@unique` | atributo Prisma | Constraint única | Valor único | Evita duplicidade |
| `@@index` | atributo Prisma | Índice de consulta | Campos indexados | Melhora performance |
| `@@unique` | atributo Prisma | Constraint composta | Combinação única | Protege regra multi-campo |
| `@db.Date` | atributo Prisma | Persistir apenas data | Date sem hora | Evita problemas de timezone em datas acadêmicas |
| `@db.Text` | atributo Prisma | Texto longo | String extensa | Usado em conteúdo e observações |

## Funções e Métodos

O `schema.prisma` não declara funções TypeScript. Ele é consumido por comandos Prisma:

| Comando | Objetivo |
|---|---|
| `prisma generate` | Gerar Prisma Client |
| `prisma migrate dev` | Criar/aplicar migrations em desenvolvimento |
| `prisma migrate deploy` | Aplicar migrations existentes em produção |
| `prisma studio` | Abrir visualização de dados |
| `prisma db seed` | Executar seed |

## Classes

O schema gera classes/tipos no Prisma Client, mas não declara classes TypeScript diretamente.

## Interfaces e Tipagens

O Prisma gera tipos para:

- models;
- enums;
- inputs;
- selects;
- includes;
- filtros;
- operações CRUD;
- payloads relacionais.

Esses tipos são consumidos pelos services via `PrismaService`.

---

# 5. Serviços e Integrações

## APIs

O schema não expõe APIs diretamente, mas sustenta todas as rotas da aplicação.

Exemplos:

| API | Models envolvidos |
|---|---|
| `/auth` | `User`, `UserSession` |
| `/users` | `User` |
| `/beneficiaries` | `Aluno`, `LaudoMedico`, `Atestado` |
| `/turmas` | `Turma`, `MatriculaOficina`, `GradeHoraria`, `User` |
| `/frequencias` | `Frequencia`, `Aluno`, `Turma`, `Atestado` |
| `/comunicados` | `Comunicado`, `User` |
| `/site-config` | `SiteConfig`, `ConteudoSecao` |
| `/certificados` | `ModeloCertificado`, `CertificadoEmitido`, `Aluno`, `Turma`, `Apoiador` |
| `/audit-log` | `AuditLog` |

## Banco de Dados

Banco utilizado:

```txt
PostgreSQL
```

A modelagem usa:

- tabelas relacionais;
- UUIDs;
- enums;
- campos opcionais;
- índices;
- chaves estrangeiras;
- constraints únicas;
- campos JSON em pontos específicos (`AuditLog`, `ModeloCertificado`).

## Serviços Externos

O schema armazena referências a serviços externos principalmente por URLs:

| Campo | Serviço provável |
|---|---|
| `fotoPerfil` | Cloudinary |
| `laudoUrl` | Cloudinary |
| `termoLgpdUrl` | Cloudinary |
| `atestadoUrl` | Cloudinary |
| `arquivoUrl` | Cloudinary |
| `imagemCapa` | Cloudinary |
| `logoUrl` | Cloudinary |
| `arteBaseUrl` | Cloudinary |
| `assinaturaUrl` | Cloudinary |
| `pdfUrl` | Cloudinary |

---

# 6. Segurança e Qualidade

## Segurança

### Usuários e sessões

`User` contém senha hash e campos legados de refresh token. A modelagem atual usa `UserSession` para refresh token por sessão.

`UserSession` armazena:

- hash do refresh token atual;
- hash do refresh token anterior;
- data da rotação anterior;
- expiração;
- revogação;
- IP;
- user agent.

Essa estrutura permite:

- refresh token rotation;
- múltiplas sessões por usuário;
- revogação por sessão;
- detecção de reuso real do token anterior.

### Dados sensíveis

`Aluno`, `LaudoMedico`, `Atestado` e campos LGPD armazenam informações pessoais e sensíveis.

Cuidados necessários:

- controle de acesso por role;
- auditoria de alterações;
- não expor dados desnecessários;
- proteção de URLs de documentos;
- retenção e exclusão conforme política institucional.

### Auditoria

`AuditLog` registra ações críticas com snapshots `oldValue` e `newValue`.

Isso melhora rastreabilidade e investigação de alterações.

## Qualidade

Pontos positivos:

- enums reduzem inconsistência;
- índices refletem consultas frequentes;
- comentários explicam decisões importantes;
- uso de `@db.Date` em datas acadêmicas evita problemas de horário;
- `AuditLog` preserva snapshot textual mesmo se usuário for removido;
- `ConteudoSecao` usa chave composta adequada para CMS flexível.

## Performance

Índices relevantes:

- busca por usuário ativo/role;
- busca de aluno por nome/matrícula/CPF;
- frequência por turma/data;
- comunicados por categoria e fixação;
- auditoria por entidade/autor/data;
- certificados por aluno/turma e código.

Esses índices reduzem custo de consultas críticas.

---

# 7. Regras de Negócio

Regras expressas no schema:

- usuário tem role padrão `PROFESSOR`;
- aluno possui matrícula única opcional;
- funcionário possui matrícula única opcional;
- matrícula de oficina possui status controlado por enum;
- turma possui status acadêmico com default `PREVISTA`;
- grade horária usa minutos desde meia-noite para evitar timezone;
- frequência é única por aluno, turma e data;
- frequência usa `status` como substituto definitivo do campo legado `presente`;
- diário pode ser fechado e reaberto;
- atestado pode justificar várias frequências;
- comunicado pertence a um autor;
- conteúdo de seção é identificado por chave composta `secao + chave`;
- auditoria é imutável por decisão arquitetural;
- apoiador pode ter ações e receber certificados de honraria;
- certificado emitido possui código único de validação;
- modelo de certificado pode ser acadêmico ou honraria.

---

# 8. Pontos de Atenção

## Riscos

- `User.refreshToken` e `User.refreshTokenExpiraEm` permanecem no schema como campos legados, apesar da arquitetura nova usar `UserSession`.
- `Frequencia.presente` é campo legado e precisa ser mantido sincronizado com `status` enquanto existir.
- `professorAuxiliarId` em `Turma` é apenas string opcional, sem relation explícita com `User`.
- Campos de URL Cloudinary não garantem integridade externa; exclusão de arquivo deve ser tratada nos services.
- Alguns campos sensíveis são opcionais, exigindo validação de negócio na camada service/DTO.
- `AuditLog` usa `cuid()` enquanto outros models usam `uuid()`, por decisão de evitar drift destrutivo.

## Débitos Técnicos

- Planejar migration futura para remover campos legados de refresh token em `User`.
- Planejar remoção de `Frequencia.presente` após migração completa para `StatusFrequencia`.
- Avaliar relação formal para `professorAuxiliarId`.
- Criar política clara de retenção para laudos, termos e atestados.
- Documentar todos os models em arquivos específicos.

## Melhorias Futuras

- Criar jobs de limpeza de `UserSession` expirada/revogada.
- Adicionar índices compostos adicionais conforme queries reais de produção.
- Criar migrations de normalização para campos legados.
- Revisar modelagem de permissões caso roles cresçam além dos quatro perfis atuais.
- Adicionar constraints adicionais se regras hoje em service precisarem migrar ao banco.

---

# 9. Relação com Outros Módulos

| Módulo | Models usados |
|---|---|
| Auth | `User`, `UserSession` |
| Users | `User` |
| Beneficiaries | `Aluno`, `LaudoMedico`, `Atestado`, `CertificadoEmitido` |
| Turmas | `Turma`, `GradeHoraria`, `MatriculaOficina`, `User`, `ModeloCertificado` |
| Frequencias | `Frequencia`, `Aluno`, `Turma`, `Atestado` |
| Atestados | `Atestado`, `Frequencia`, `Aluno` |
| Laudos | `LaudoMedico`, `Aluno` |
| Comunicados | `Comunicado`, `User` |
| SiteConfig | `SiteConfig`, `ConteudoSecao` |
| Contatos | `MensagemContato` |
| AuditLog | `AuditLog` |
| Apoiadores | `Apoiador`, `AcaoApoiador` |
| Certificados | `ModeloCertificado`, `CertificadoEmitido`, `Aluno`, `Turma`, `Apoiador`, `AcaoApoiador` |

---

# 10. Resumo Técnico Final

O `schema.prisma` é a fonte de verdade da persistência da Braille API. Ele representa um domínio institucional completo, com usuários internos, alunos, turmas, frequências, documentos, CMS, auditoria, apoiadores e certificados.

## Função do módulo

Definir estrutura do banco, relacionamentos, enums, índices e constraints usados pelo Prisma Client.

## Importância no sistema

Crítica. Qualquer erro no schema afeta migrations, Prisma Client, services e regras de negócio.

## Nível de criticidade

Muito alto, pois envolve dados pessoais, documentos sensíveis, autenticação, auditoria e certificados.

## Complexidade

Alta. O schema possui múltiplos domínios, relações e decisões legadas controladas.

## Principais integrações

- Prisma Client;
- PostgreSQL;
- Prisma migrations;
- Prisma ERD Generator;
- services NestJS;
- Cloudinary por armazenamento de URLs.

## Observações finais

A modelagem está madura e cobre os principais domínios do sistema. Os maiores pontos de atenção são campos legados, dados sensíveis, sincronização entre service e banco, e necessidade de documentação individual por entidade nos próximos arquivos da série `82-db-*`.
