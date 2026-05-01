# 09 — Prisma Migrations (`prisma/migrations/`)

---

# 1. Visão Geral

## Objetivo

Este documento descreve a estratégia de migrations Prisma da Braille API.

As migrations são responsáveis por versionar mudanças estruturais no banco PostgreSQL. Elas representam a evolução controlada do `schema.prisma` para o banco real, garantindo rastreabilidade, repetibilidade e segurança em desenvolvimento, homologação e produção.

## Responsabilidade

A camada de migrations é responsável por:

- transformar alterações do `schema.prisma` em SQL versionado;
- aplicar mudanças estruturais no PostgreSQL;
- preservar histórico de evolução do banco;
- permitir deploy controlado;
- evitar alterações manuais sem rastreabilidade;
- reduzir risco de drift entre schema e banco;
- documentar decisões estruturais sensíveis, como criação de sessões de usuário.

## Fluxo de Funcionamento

Fluxo em desenvolvimento:

```txt
Alteração no prisma/schema.prisma
  ↓
npm run db:migrate:dev
  ↓
Prisma cria migration SQL
  ↓
Migration é aplicada no banco local
  ↓
Prisma Client é regenerado
  ↓
Código é ajustado e testado
```

Fluxo em produção/homologação:

```txt
Código com migrations já versionadas
  ↓
npm run db:migrate:deploy
  ↓
Prisma aplica migrations pendentes
  ↓
npm run db:generate
  ↓
npm run build
  ↓
npm run start:prod
```

---

# 2. Arquitetura e Metodologias

## Padrões Arquiteturais Identificados

- **Migration Versioning Pattern**: cada mudança estrutural é registrada em pasta versionada.
- **Schema Evolution Pattern**: `schema.prisma` evolui junto com migrations SQL.
- **Deploy-safe Migration Pattern**: produção usa `prisma migrate deploy`, não `migrate dev`.
- **Backward Compatibility Pattern**: campos antigos podem ser mantidos temporariamente durante transições.
- **Fail Fast Pattern**: falhas de aplicação de migration interrompem o processo antes do runtime.

## Justificativa Técnica

O banco da Braille API contém dados sensíveis e operacionais: usuários, alunos, laudos, atestados, frequências, certificados e auditoria. Por isso, alterações estruturais precisam ser controladas.

Usar migrations versionadas evita:

- inconsistência entre ambientes;
- alterações manuais não documentadas;
- divergência entre Prisma Client e banco real;
- deploy não reproduzível;
- perda de rastreabilidade histórica.

A separação entre `db:migrate:dev` e `db:migrate:deploy` é fundamental:

- `migrate dev` é para criação e validação local;
- `migrate deploy` é para aplicar migrations já revisadas em ambientes reais.

---

# 3. Fluxo Interno do Código

## Fluxo de Execução

### 1. Alteração no schema

Toda alteração estrutural começa em:

```txt
prisma/schema.prisma
```

Exemplos de alterações:

- adicionar model;
- adicionar campo;
- alterar relacionamento;
- criar índice;
- criar enum;
- adicionar constraint.

### 2. Migration em desenvolvimento

Comando:

```bash
npm run db:migrate:dev
```

Executa:

```bash
prisma migrate dev
```

Responsabilidades:

- detectar diferença entre schema e banco local;
- criar pasta em `prisma/migrations/`;
- gerar `migration.sql`;
- aplicar no banco de desenvolvimento;
- regenerar Prisma Client.

### 3. Migration em produção/homologação

Comando:

```bash
npm run db:migrate:deploy
```

Executa:

```bash
prisma migrate deploy
```

Responsabilidades:

- localizar migrations pendentes;
- aplicar migrations já versionadas;
- não criar migration nova;
- não iniciar fluxo interativo;
- ser adequado para CI/CD.

### 4. Regeneração do Prisma Client

Comando:

```bash
npm run db:generate
```

Executa:

```bash
prisma generate
```

Deve ser usado após mudanças no schema para garantir que o Prisma Client contenha os novos models, campos e relações.

### 5. Migration de `UserSession`

Arquivo confirmado:

```txt
prisma/migrations/20260430153000_add_user_sessions/migration.sql
```

Responsabilidade:

- criar tabela dedicada para sessões de usuário;
- armazenar hash do refresh token;
- armazenar expiração da sessão;
- armazenar revogação;
- armazenar user agent e IP;
- criar índices para usuário, expiração e revogação;
- relacionar sessão ao usuário.

Decisão técnica importante:

- os campos legados `User.refreshToken` e `User.refreshTokenExpiraEm` foram mantidos nesta etapa para permitir transição segura.

### 6. Migration de refresh token anterior

Arquivo confirmado:

```txt
prisma/migrations/20260430162000_add_previous_refresh_token_to_user_sessions/migration.sql
```

Responsabilidade:

- adicionar `previousRefreshTokenHash`;
- adicionar `previousRotatedAt`.

Objetivo:

- diferenciar token aleatório inválido de reuso real do refresh token anterior;
- revogar sessão apenas quando houver reuso real;
- evitar logout indevido por token malformado.

### 7. Sequência recomendada em deploy

```bash
npm install
npm run db:migrate:deploy
npm run db:generate
npm run build
npm run start:prod
```

Observação:

- `build` não deve aplicar migrations;
- `db:migrate:deploy` deve ser etapa explícita e controlada.

## Dependências Internas

| Dependência | Uso |
|---|---|
| `prisma/schema.prisma` | Fonte das mudanças estruturais |
| `prisma/migrations/` | Histórico SQL versionado |
| `package.json` | Scripts `db:migrate:dev`, `db:migrate:deploy`, `db:generate` |
| `PrismaService` | Consome Prisma Client gerado após migrations |
| Services de domínio | Dependem dos campos e relações existentes |

## Dependências Externas

| Dependência | Uso |
|---|---|
| `prisma` | CLI de migrations |
| `@prisma/client` | Client gerado após schema/migrations |
| PostgreSQL | Banco alvo das migrations |

---

# 4. Dicionário Técnico

## Variáveis e Estruturas

| Nome | Tipo | Objetivo | Valor esperado | Impacto no sistema |
|---|---|---|---|---|
| `DATABASE_URL` | env | Conexão principal Prisma | URL PostgreSQL | Necessária para migrations e runtime |
| `DIRECT_URL` | env | Conexão direta ao banco | URL PostgreSQL | Usada em contextos de migration/conexão direta |
| `migration.sql` | arquivo SQL | Alteração versionada do banco | SQL compatível com PostgreSQL | Aplica mudança estrutural |
| `_prisma_migrations` | tabela interna Prisma | Controle de migrations aplicadas | Registros internos | Evita reaplicação indevida |
| `schema.prisma` | arquivo Prisma | Modelo fonte | Schema válido | Gera migrations e client |

## Funções e Métodos

### `prisma migrate dev`

| Item | Descrição |
|---|---|
| Objetivo | Criar e aplicar migrations em desenvolvimento |
| Ambiente | Desenvolvimento |
| Uso em produção | Não recomendado |

### `prisma migrate deploy`

| Item | Descrição |
|---|---|
| Objetivo | Aplicar migrations pendentes já versionadas |
| Ambiente | Produção/homologação |
| Uso em produção | Recomendado |

### `prisma generate`

| Item | Descrição |
|---|---|
| Objetivo | Gerar Prisma Client |
| Ambiente | Todos |
| Uso | Após schema/migrations ou instalação |

### `prisma studio`

| Item | Descrição |
|---|---|
| Objetivo | Inspecionar dados visualmente |
| Ambiente | Desenvolvimento |
| Uso em produção | Não recomendado |

## Classes

Migrations não declaram classes TypeScript. Elas geram estrutura que será consumida pelo Prisma Client e pelos services.

## Interfaces e Tipagens

Após migrations e `prisma generate`, o Prisma Client gera tipos referentes aos novos models/campos.

Exemplo:

```txt
migration cria UserSession
  ↓
schema declara model UserSession
  ↓
prisma generate cria prisma.userSession
  ↓
AuthService usa this.prisma.userSession
```

---

# 5. Serviços e Integrações

## APIs

Migrations não expõem endpoints, mas impactam endpoints que dependem do banco.

| Migration | APIs impactadas |
|---|---|
| `add_user_sessions` | `/auth/login`, `/auth/refresh`, `/auth/logout` |
| `add_previous_refresh_token_to_user_sessions` | `/auth/refresh` |
| mudanças em frequência | `/frequencias` |
| mudanças em turmas | `/turmas` |
| mudanças em alunos | `/beneficiaries` |

## Banco de Dados

As migrations são aplicadas no PostgreSQL.

Elas podem criar ou ajustar:

- tabelas;
- colunas;
- índices;
- constraints;
- relações;
- enums;
- chaves estrangeiras.

## Serviços Externos

Não há serviço externo direto além do banco PostgreSQL.

---

# 6. Segurança e Qualidade

## Segurança

Migrations afetam diretamente segurança quando alteram:

- sessões;
- autenticação;
- auditoria;
- dados pessoais;
- dados médicos;
- certificados;
- permissões indiretas via relações.

A migration de `UserSession` melhorou segurança ao migrar refresh tokens para tabela dedicada por sessão.

A migration de `previousRefreshTokenHash` melhorou segurança e experiência do usuário ao diferenciar:

- token anterior reutilizado;
- token aleatório inválido.

## Qualidade

Boas práticas identificadas:

- migrations recentes possuem comentários explicativos;
- mudanças sensíveis foram feitas de forma compatível com transição;
- campos legados foram preservados temporariamente;
- índices foram criados junto com tabela de sessão;
- a relação `UserSession.userId` remove sessões quando o usuário é removido.

## Performance

Migrations podem melhorar performance ao criar índices.

Exemplo em `UserSession`:

- índice por `userId`;
- índice por `expiresAt`;
- índice por `revokedAt`.

Esses índices favorecem:

- busca de sessões por usuário;
- limpeza futura de sessões expiradas;
- filtros por revogação.

---

# 7. Regras de Negócio

Regras representadas pelas migrations recentes:

- refresh token deve ser controlado por sessão dedicada;
- usuário pode ter múltiplas sessões;
- sessão pertence a um usuário;
- refresh token atual deve ser armazenado apenas como hash;
- refresh token anterior também deve ser armazenado apenas como hash;
- campos legados de refresh token em `User` devem ser preservados temporariamente;
- token aleatório inválido não deve revogar sessão;
- reuso real do token anterior deve revogar sessão.

---

# 8. Pontos de Atenção

## Riscos

- Rodar `prisma migrate dev` em produção não é recomendado.
- Alterar migration já aplicada é perigoso; o correto é criar nova migration.
- Se `schema.prisma` mudar sem migration correspondente, pode ocorrer drift.
- Se migration for aplicada mas `prisma generate` não for executado, o Prisma Client pode ficar desatualizado.
- Campos legados mantidos precisam de plano de remoção futuro.

## Débitos Técnicos

- Criar documentação completa do histórico de todas as migrations antigas.
- Criar política de nomenclatura para migrations.
- Criar checklist antes de migration em produção.
- Criar rotina futura para limpar sessões expiradas/revogadas.
- Planejar migration de remoção dos campos legados `User.refreshToken` e `User.refreshTokenExpiraEm`.

## Melhorias Futuras

- Adicionar pipeline CI com `prisma validate`.
- Adicionar pipeline CI com `prisma migrate status`.
- Criar backup operacional antes de migrations críticas.
- Criar documentação de recuperação operacional.
- Adicionar teste e2e para fluxo após migrations críticas.

---

# 9. Relação com Outros Módulos

| Módulo | Relação com migrations |
|---|---|
| `PrismaService` | Usa Prisma Client gerado após migrations |
| `AuthService` | Depende de `UserSession` e campos de sessão |
| `UsersService` | Depende de `User` e campos legados/novos |
| `BeneficiariesService` | Depende de `Aluno` e relações documentais |
| `TurmasService` | Depende de `Turma`, `GradeHoraria`, `MatriculaOficina` |
| `FrequenciasService` | Depende de `Frequencia` e constraints de data/aluno/turma |
| `AtestadosService` | Depende de `Atestado` e relação com frequência |
| `CertificadosService` | Depende de models de certificado |
| `AuditLogService` | Depende de `AuditLog` |
| Deploy | Depende de `db:migrate:deploy` |

---

# 10. Resumo Técnico Final

As migrations Prisma são o mecanismo oficial de evolução estrutural do banco da Braille API. Elas garantem que mudanças no `schema.prisma` sejam aplicadas de forma versionada, rastreável e segura.

## Função do módulo

Versionar e aplicar alterações estruturais no PostgreSQL.

## Importância no sistema

Crítica. Uma migration incorreta pode causar indisponibilidade ou divergência entre código e banco.

## Nível de criticidade

Muito alto, especialmente por envolver autenticação, sessões, alunos, documentos médicos, frequências e certificados.

## Complexidade

Média/Alta. A complexidade vem da quantidade de domínios, dados sensíveis e necessidade de compatibilidade com dados existentes.

## Principais integrações

- Prisma CLI;
- PostgreSQL;
- `schema.prisma`;
- Prisma Client;
- pipeline de deploy.

## Observações finais

A estratégia atual está correta: migrations recentes foram feitas com preservação de campos legados e criação de estrutura profissional para sessões. O principal cuidado futuro é manter disciplina operacional: não editar migration já aplicada, gerar novas migrations para novas mudanças e executar `db:migrate:deploy` explicitamente em produção.
