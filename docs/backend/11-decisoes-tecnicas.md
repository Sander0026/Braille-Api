# Decisões Técnicas (ADRs) — Braille-Api

---

> **ADR = Architecture Decision Record**  
> Este documento registra o "por quê" de cada decisão técnica não-óbvia do projeto. Novas decisões significativas devem ser adicionadas aqui.

---

## ADR-001: NestJS como Framework Principal

**Status:** Aceito  
**Contexto:** O time precisava de um framework Node.js robusto para construir uma API REST com múltiplos módulos de negócio, autenticação, auditoria e integrações externas.

**Decisão:** Adotar NestJS.

**Justificativa:**
- Injeção de dependência nativa elimina boilerplate de instanciação manual
- Sistema de módulos força organização por domínio de negócio
- Decorators integram guards, interceptors e pipes de forma declarativa
- Swagger automático via anotações
- Ecossistema maduro: `@nestjs/jwt`, `@nestjs/schedule`, `@nestjs/throttler`

**Consequências:** Curva de aprendizado maior para devs acostumados com Express puro. Compensa na manutenibilidade de longo prazo.

---

## ADR-002: Prisma como ORM

**Status:** Aceito  
**Contexto:** Precisávamos de acesso ao banco com type-safety e gestão de migrations.

**Decisão:** Adotar Prisma ORM.

**Justificativa:**
- Schema declarativo (`schema.prisma`) é fonte única de verdade do banco
- Client tipado gerado automaticamente — erros de tipo em queries detectados em compile time
- Migrations declarativas e versionadas em `prisma/migrations/`
- Prisma Studio como interface gráfica gratuita para debug
- `prisma-erd-generator` gera diagrama ERD automaticamente

**Consequências:** O Prisma Client não suporta queries SQL 100% expressivas (ex: window functions complexas). Em casos extremos, usar `prisma.$queryRaw`.

---

## ADR-003: Cloudinary como CDN de Arquivos

**Status:** Aceito  
**Contexto:** O sistema precisa armazenar fotos de perfil, laudos, atestados, termos LGPD e certificados PDF.

**Decisão:** Usar Cloudinary.

**Justificativa:**
- Free tier generoso: 25GB storage + 25GB bandwidth
- CDN global: baixa latência para usuários brasileiros
- Transformações via URL (resize, qualidade, formato) sem código extra
- `upload_stream` evita gravação temporária em disco — fundamental para ambientes serverless (Render.com)

**Consequências:** Dependência de serviço externo. Se Cloudinary ficar indisponível, uploads param. Mitigação: validar arquivos antes de enviar e exibir erro amigável.

---

## ADR-004: Dois campos de inativação (`statusAtivo` + `excluido`)

**Status:** Aceito  
**Contexto:** O sistema precisa distinguir inativação temporária de exclusão permanente por LGPD.

**Decisão:** Dois campos booleanos separados.

| Campo | Significa | Reversível? | Quem usa |
|---|---|---|---|
| `statusAtivo: false` | Desativado temporariamente | ✅ Sim | Admin desativa/reativa |
| `excluido: true` | Arquivado por LGPD | ❌ Não (normalmente) | Admin arquiva definitivamente |

**Justificativa:** Misturar os conceitos em um único campo (ex: status enum) criaria ambiguidade semântica e dificultaria queries de "todos inativos mas não excluídos".

---

## ADR-005: Horários em minutos inteiros (GradeHoraria)

**Status:** Aceito  
**Contexto:** Precisávamos armazenar horários de início e fim de aulas para verificação de colisão.

**Decisão:** Armazenar como `Int` representando minutos desde meia-noite.

**Exemplo:** 14:00 → `840`, 16:30 → `990`

**Justificativa:**
- Evita problemas de timezone: `DateTime` teria comportamento diferente entre servidor UTC e clientes no fuso de Brasília
- Colisão de intervalos é aritmética simples: `a.horaInicio < b.horaFim && b.horaInicio < a.horaFim`
- Comparações eficientes no banco sem conversão de tipo
- Sem ambiguidade de DST (horário de verão)

---

## ADR-006: `@db.Date` na Frequência

**Status:** Aceito  
**Contexto:** O campo `dataAula` da Frequência deve ser apenas uma data (sem hora), garantindo um registro por aluno por turma por dia.

**Decisão:** Usar `@db.Date` no schema Prisma.

**Justificativa:** Sem `@db.Date`, o campo seria `timestamp`. Dois registros criados em momentos diferentes do mesmo dia (`2026-03-11T10:00:00Z` e `2026-03-11T14:00:00Z`) seriam tratados como datas diferentes, burlando a constraint `@@unique([dataAula, alunoId, turmaId])`.

---

## ADR-007: UserSession como tabela separada (não campo no User)

**Status:** Aceito  
**Contexto:** O sistema precisava suportar múltiplos dispositivos simultâneos e revogação granular de sessões.

**Decisão:** Criar tabela `UserSession` separada.

**Justificativa:**
- Um usuário pode ter múltiplas sessões ativas (PC, tablet, celular)
- Logout em um dispositivo revoga apenas a sessão específica
- Armazenar múltiplos refresh tokens em um campo JSON no User seria não-normalizado e difícil de consultar
- `UserSession.revokedAt` permite histórico de sessões revogadas para auditoria forense

**Consequências:** Os campos `refreshToken` e `refreshTokenExpiraEm` no modelo `User` tornaram-se legados e devem ser removidos em migration futura.

---

## ADR-008: cuid() no AuditLog (Tech Debt Documentado)

**Status:** Aceito com restrição  
**Contexto:** O AuditLog foi criado antes da padronização `uuid()` do projeto.

**Decisão:** Manter `cuid()` no AuditLog.

**Justificativa:** Mudar a função de geração de ID em uma tabela existente com dados históricos exigiria:
1. Script de migração de todos os IDs existentes
2. Atualização de todas as FKs que referenciam AuditLog (none no momento)
3. Risco de corrupção de dados

**Consequências:** Inconsistência estética nos IDs. Não há impacto funcional — ambos `cuid()` e `uuid()` são globalmente únicos. Documentado como tech debt para resolver em momento dedicado.

---

## ADR-009: `precisaTrocarSenha` no Payload JWT

**Status:** Aceito  
**Contexto:** O frontend precisa saber se deve forçar o redirect de troca de senha logo após o login.

**Decisão:** Incluir `precisaTrocarSenha: boolean` no payload JWT.

**Justificativa:** A alternativa seria um roundtrip extra ao backend após login (`GET /auth/me`) para obter esse status. Incluir no JWT elimina essa latência. O campo é de baixo risco — não é sensível, apenas um flag booleano.

**Consequências:** Se o admin alterar `precisaTrocarSenha` de um usuário durante a sessão, o JWT existente ainda terá o valor antigo até expirar (máx. 15min). Risco considerado aceitável.

---

## ADR-010: Auditoria Fire-and-Forget

**Status:** Aceito  
**Contexto:** O `AuditLogService.registrar()` pode falhar (ex: banco temporariamente indisponível).

**Decisão:** Erros de auditoria são silenciados (`logger.warn`) e nunca propagados ao fluxo principal.

**Justificativa:** Auditoria é uma preocupação transversal de observabilidade, não uma regra de negócio. Falhar uma operação de criação de aluno porque o audit log não gravou seria uma política de disponibilidade incorreta — a operação principal deve ser preservada.

**Consequências:** Lacunas de auditoria em cenários de falha do banco. Risco mitigado por: (1) banco de alta disponibilidade, (2) logs do servidor capturando a falha com `warn`.

---

## ADR-011: Exportação Excel em Streaming

**Status:** Aceito  
**Contexto:** A exportação de alunos pode envolver milhares de registros.

**Decisão:** Usar `ExcelJS.stream.xlsx.WorkbookWriter` com paginação de 1000 registros.

**Justificativa:**
- Carregar todos os alunos em memória causaria OOM (Out of Memory) em produção
- O streaming faz `pipe` direto para o `Response` HTTP, sem buffer intermediário
- Paginação de 1000 garante que cada query ao banco seja rápida

**Consequências:** A resposta HTTP começa a ser enviada antes de todos os dados serem processados. Se o cliente desconectar no meio, o arquivo ficará incompleto — mas isso é comportamento esperado em streaming.

---

## ADR-012: Deploy no Render.com

**Status:** Aceito  
**Contexto:** Necessidade de hospedagem da API com custo zero ou mínimo.

**Decisão:** Usar Render.com como plataforma de deploy.

**Justificativa:**
- Free tier com sleep em inatividade (aceitável para instituição de médio porte)
- Deploy automático via GitHub
- Variáveis de ambiente gerenciadas pelo painel
- Suporte a PostgreSQL via Supabase externo

**Consequências:** Cold start de ~30s quando a instância hiberna. Em produção, considerar upgrade para o plano pago para instância sempre ativa.
