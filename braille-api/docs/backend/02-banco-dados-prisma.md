# Módulo: Banco de Dados e Prisma

---

# 1. Visão Geral

## Objetivo

Documentar a camada de persistência da Braille API, baseada em PostgreSQL e Prisma ORM.

## Responsabilidade

O banco de dados armazena usuários, sessões, alunos, turmas, matrículas, frequências, documentos, comunicados, configurações públicas, logs de auditoria, apoiadores e certificados. O Prisma define o schema, gera o client tipado e controla migrations versionadas.

## Fluxo de Funcionamento

1. `schema.prisma` define datasource PostgreSQL.
2. Models representam tabelas.
3. Enums padronizam valores de domínio.
4. Migrations versionam alterações estruturais.
5. `PrismaService` disponibiliza acesso tipado aos services.
6. Services usam `prisma.<model>` para queries, criação, atualização e contagem.

---

# 2. Arquitetura e Metodologias

## Padrões Arquiteturais Identificados

- ORM/Data Mapper.
- Repository-like access via Prisma Client.
- Domain Modeling com models Prisma.
- Soft Delete em entidades sensíveis.
- Audit Trail.
- Migration-based schema evolution.

## Justificativa Técnica

Prisma fornece tipagem forte, migrations controladas, relações explícitas e integração direta com TypeScript. Isso reduz erros de query e documenta o banco como parte do código-fonte.

---

# 3. Fluxo Interno do Código

## Fluxo de Execução

1. Service recebe uma operação de domínio.
2. Service monta filtros e valida regras.
3. Prisma Client executa query no PostgreSQL.
4. Resultado retorna tipado ao service.
5. Service sanitiza campos sensíveis quando necessário.
6. Controller devolve resposta HTTP.

## Dependências Internas

- `prisma/schema.prisma`
- `prisma/migrations/*`
- `src/prisma/prisma.service.ts`
- `src/prisma/prisma.module.ts`

## Dependências Externas

- `@prisma/client`
- `prisma`
- PostgreSQL

---

# 4. Dicionário Técnico

## Principais Enums

| Enum | Objetivo |
|---|---|
| `Role` | Perfis de autorização: ADMIN, SECRETARIA, PROFESSOR, COMUNICACAO |
| `MatriculaStatus` | Status de matrícula em oficina |
| `TurmaStatus` | Ciclo acadêmico da turma |
| `TipoDeficiencia` | Perfil de deficiência visual |
| `CategoriaComunicado` | Classificação de comunicado público |
| `StatusFrequencia` | Presença, falta ou falta justificada |
| `AuditAcao` | Tipos de ações auditáveis |
| `TipoApoiador` | Categoria de apoiador |
| `TipoCertificado` | Acadêmico ou honraria |

## Principais Models

### `User`

Representa funcionários do sistema. Possui credenciais, perfil, dados de contato, status lógico, foto, turmas ministradas, comunicados criados e sessões.

Campos relevantes:

- `id`: UUID primário.
- `username`: login único.
- `senha`: hash bcrypt.
- `role`: perfil de autorização.
- `statusAtivo`: controla acesso ativo.
- `excluido`: exclusão lógica profunda.
- `sessoes`: relação com `UserSession`.
- `refreshToken` e `refreshTokenExpiraEm`: campos legados mantidos para transição.

### `UserSession`

Representa sessão autenticada por dispositivo/navegador.

Campos relevantes:

- `id`: UUID da sessão.
- `userId`: dono da sessão.
- `refreshTokenHash`: hash do segredo atual.
- `previousRefreshTokenHash`: hash do refresh token anterior.
- `previousRotatedAt`: data da última rotação anterior.
- `expiresAt`: expiração da sessão.
- `revokedAt`: revogação lógica.
- `userAgent` e `ip`: rastreabilidade.

### `Aluno`

Representa beneficiário da instituição. Guarda dados pessoais, endereço, deficiência, documentos LGPD, laudos, atestados, status e relações acadêmicas.

### `Turma`

Representa oficina ou turma. Relaciona professor principal, grade horária, matrículas, frequências e certificados.

### `Frequencia`

Registra presença por aluno, turma e data. Usa chave única composta por `dataAula`, `alunoId` e `turmaId`.

### `Comunicado`

Representa notícia ou comunicado público, com categoria, capa, fixação, autor e datas.

### `AuditLog`

Registra ações críticas. Deve ser tratado como registro imutável.

### `CertificadoEmitido`

Registra certificados emitidos com código de validação público, aluno ou apoiador, turma, modelo e PDF.

---

# 5. Serviços e Integrações

## APIs

O banco é consumido indiretamente pelas APIs de domínio. Nenhum controller deve acessar banco diretamente; a responsabilidade é dos services.

## Banco de Dados

- Banco: PostgreSQL.
- ORM: Prisma.
- Migrations: `prisma/migrations`.
- Client: gerado por `prisma generate`.

## Migrations relevantes

- Criação de sessões de usuário.
- Inclusão de expiração de refresh token legada.
- Inclusão de rastreio do refresh token anterior.

---

# 6. Segurança e Qualidade

## Segurança

- Senhas e refresh tokens são armazenados como hash.
- Sessões podem ser revogadas.
- Dados sensíveis são selecionados de forma cirúrgica nos services.
- Índices auxiliam desempenho e reduzem queries custosas.

## Qualidade

- Schema versionado.
- Relações explícitas.
- Enums evitam strings soltas.
- Soft delete preserva histórico.

## Performance

- Índices em campos de busca frequente.
- Paginação em listagens.
- Chaves únicas evitam duplicidade.

---

# 7. Regras de Negócio

- Um usuário pode ter múltiplas sessões.
- Um aluno só pode ter uma frequência por turma/data.
- CPF e RG são únicos quando informados.
- Certificado possui código único de validação.
- AuditLog não deve ser alterado ou deletado.
- Campos legados devem ser removidos apenas em migração planejada.

---

# 8. Pontos de Atenção

- `User.refreshToken` e `User.refreshTokenExpiraEm` são legados.
- `Frequencia.presente` é legado e deve futuramente ser substituído totalmente por `status`.
- Antes de produção, rodar `db:migrate:deploy` e `db:generate`.
- Alterações manuais em migrations devem ser refletidas no schema.

---

# 9. Relação com Outros Módulos

Todos os services dependem direta ou indiretamente do Prisma. Auth usa `User` e `UserSession`; Users usa `User`; Beneficiaries usa `Aluno`; Turmas usa `Turma`, `GradeHoraria` e `MatriculaOficina`; Frequencias usa `Frequencia`; Certificados usa modelos de certificados e certificados emitidos.

---

# 10. Resumo Técnico Final

A camada Prisma/PostgreSQL é crítica e central. Ela concentra a verdade estrutural do sistema e sustenta autenticação, dados institucionais, fluxos acadêmicos, documentos, auditoria e conteúdo público.