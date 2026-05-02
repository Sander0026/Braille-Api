# Índice da Documentação — Braille-Api Backend

> Última atualização: 2026-05-02

---

## 📋 Documentação Geral

| Documento | Descrição |
|---|---|
| [00-visao-geral.md](00-visao-geral.md) | Arquitetura macro, stack tecnológica, diagrama de módulos |
| [01-setup.md](01-setup.md) | Setup local completo, scripts, troubleshooting, deploy no Render |
| [02-banco-de-dados.md](02-banco-de-dados.md) | Schema Prisma, modelos, enums, índices, decisões de design |
| [03-autenticacao.md](03-autenticacao.md) | Fluxo de auth completo com diagramas sequenciais |
| [05-seguranca.md](05-seguranca.md) | Todas as medidas de segurança implementadas por categoria |
| [06-auditoria.md](06-auditoria.md) | AuditInterceptor, AuditLog imutável, como adicionar auditoria |
| [09-testes.md](09-testes.md) | Estratégia de testes, templates, boas práticas |
| [10-variaveis-ambiente.md](10-variaveis-ambiente.md) | Referência completa de todas as env vars |
| [11-decisoes-tecnicas.md](11-decisoes-tecnicas.md) | ADRs — "por que" de cada decisão arquitetural |

---

## 🧩 Módulos de Negócio

| Módulo | Documento | Criticidade |
|---|---|---|
| Autenticação | [modulos/auth.md](modulos/auth.md) | 🔴 Máxima |
| Beneficiários (Alunos) | [modulos/beneficiaries.md](modulos/beneficiaries.md) | 🔴 Máxima |
| Turmas | [modulos/turmas.md](modulos/turmas.md) | 🔴 Alta |
| Frequências | [modulos/frequencias.md](modulos/frequencias.md) | 🔴 Alta |
| Usuários (Funcionários) | [modulos/users.md](modulos/users.md) | 🔴 Alta |
| Audit Log | [modulos/audit-log.md](modulos/audit-log.md) | 🔴 Alta |
| Upload (Cloudinary) | [modulos/upload.md](modulos/upload.md) | 🟡 Importante |
| Certificados | [modulos/certificados.md](modulos/certificados.md) | 🟡 Importante |
| Apoiadores | _(em construção)_ | 🟡 Normal |
| Comunicados | _(em construção)_ | 🟢 Normal |
| Contatos | _(em construção)_ | 🟢 Normal |
| Dashboard | _(em construção)_ | 🟢 Normal |
| Site Config | _(em construção)_ | 🟢 Normal |
| Laudos | _(em construção)_ | 🟡 Normal |
| Atestados | _(em construção)_ | 🟡 Normal |

---

## 🏗️ Infraestrutura Compartilhada

| Documento | Descrição |
|---|---|
| [common/infraestrutura.md](common/infraestrutura.md) | Interceptors, Filters, Guards, Helpers, Interfaces |

---

## 📁 Arquivos Raiz

| Arquivo | Descrição |
|---|---|
| [README.md](../../README.md) | Ponto de entrada, setup rápido, arquitetura |
| [CONTRIBUTING.md](../../CONTRIBUTING.md) | Padrões de código, fluxo Git, checklist de PR |
| [SECURITY.md](../../SECURITY.md) | Política de segurança e divulgação de vulnerabilidades |
| [.env.example](../../.env.example) | Template de variáveis de ambiente |

---

## 🗺️ Como Navegar esta Documentação

**Sou dev novo e quero rodar o projeto:**
→ [01-setup.md](01-setup.md) → [10-variaveis-ambiente.md](10-variaveis-ambiente.md)

**Quero entender a arquitetura geral:**
→ [00-visao-geral.md](00-visao-geral.md) → [02-banco-de-dados.md](02-banco-de-dados.md)

**Preciso implementar autenticação/autorização:**
→ [03-autenticacao.md](03-autenticacao.md) → [modulos/auth.md](modulos/auth.md)

**Preciso adicionar um novo módulo:**
→ [CONTRIBUTING.md](../../CONTRIBUTING.md) → [common/infraestrutura.md](common/infraestrutura.md) → [06-auditoria.md](06-auditoria.md)

**Preciso entender por que X foi feito assim:**
→ [11-decisoes-tecnicas.md](11-decisoes-tecnicas.md)

**Preciso escrever testes:**
→ [09-testes.md](09-testes.md)
