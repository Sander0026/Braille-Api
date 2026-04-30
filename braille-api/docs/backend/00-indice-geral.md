# 00 — Índice Geral da Documentação Backend

---

# 1. Visão Geral

## Objetivo

Este arquivo é o índice mestre da documentação técnica da **Braille API** na branch `dev`.

A documentação será criada **um arquivo por vez**, por módulo, rota, camada técnica, entidade de banco ou integração. Essa estratégia evita documentos grandes demais, reduz risco de quebra de contexto e facilita manutenção futura.

## Responsabilidade

Este índice deve:

- mapear todos os tópicos documentáveis do backend;
- indicar o nome do arquivo Markdown de cada tópico;
- controlar o status de documentação;
- manter rastreabilidade entre módulos, rotas, services, banco de dados e integrações;
- servir como ponto inicial para qualquer auditoria técnica futura.

## Diretório padrão

```txt
docs/backend/
```

---

# 2. Convenção de Status

| Status | Significado |
|---|---|
| `Pendente` | Documento ainda não criado ou incompleto |
| `Em andamento` | Documento iniciado, mas ainda não validado |
| `Documentado` | Documento concluído com visão geral, fluxo, segurança, regras e pontos de atenção |
| `Revisar` | Documento existe, mas precisa ser atualizado após mudança no código |

---

# 3. Ordem Recomendada de Documentação

A documentação deve seguir esta ordem:

1. Arquitetura base;
2. Bootstrap e módulo raiz;
3. Configuração, deploy e ambiente;
4. Banco de dados e migrations;
5. Autenticação, sessão e RBAC;
6. Common, filtros, pipes, interceptors e helpers;
7. Módulos administrativos;
8. Módulos acadêmicos;
9. Documentos, uploads e certificados;
10. Conteúdo público e CMS;
11. Auditoria;
12. Rotas por domínio;
13. Integrações externas;
14. Qualidade, performance e débitos técnicos.

---

# 4. Infraestrutura Base

| Ordem | Arquivo | Tema | Status |
|---:|---|---|---|
| 01 | `01-visao-geral-arquitetura.md` | Arquitetura geral do backend NestJS | Pendente |
| 02 | `02-bootstrap-main.md` | Inicialização em `main.ts` | Pendente |
| 03 | `03-app-module.md` | Composição do `AppModule` | Pendente |
| 04 | `04-configuracao-ambiente.md` | Validação de variáveis de ambiente | Pendente |
| 05 | `05-swagger-openapi.md` | Swagger e documentação de API | Pendente |
| 06 | `06-scripts-build-deploy.md` | Scripts npm, build, migrations e deploy | Pendente |
| 07 | `07-prisma-service.md` | PrismaService e conexão com banco | Pendente |
| 08 | `08-prisma-schema.md` | Schema Prisma completo | Pendente |
| 09 | `09-prisma-migrations.md` | Migrations e evolução do banco | Pendente |

---

# 5. Segurança, Auth e Sessões

| Ordem | Arquivo | Tema | Status |
|---:|---|---|---|
| 10 | `10-auth-visao-geral.md` | Visão geral do módulo Auth | Pendente |
| 11 | `11-auth-controller.md` | Rotas de autenticação | Pendente |
| 12 | `12-auth-service.md` | Login, logout, perfil e troca de senha | Pendente |
| 13 | `13-auth-refresh-token-sessoes.md` | Refresh token, `UserSession` e rotação | Pendente |
| 14 | `14-auth-guards.md` | `AuthGuard` e `RolesGuard` | Pendente |
| 15 | `15-auth-dtos-interfaces.md` | DTOs, payload JWT e interfaces | Pendente |
| 16 | `16-rbac-matriz-permissoes.md` | Matriz de permissões por role | Pendente |
| 17 | `17-seguranca-global.md` | Helmet, CORS, Throttler e ValidationPipe | Pendente |

---

# 6. Common e Cross-Cutting Concerns

| Ordem | Arquivo | Tema | Status |
|---:|---|---|---|
| 18 | `18-common-visao-geral.md` | Estrutura `src/common` | Pendente |
| 19 | `19-common-api-response.md` | DTO padronizado de resposta | Pendente |
| 20 | `20-common-filters-prisma.md` | Filtros globais Prisma | Pendente |
| 21 | `21-common-audit-interceptor.md` | Interceptor global de auditoria | Pendente |
| 22 | `22-common-sanitize-html-pipe.md` | Sanitização HTML | Pendente |
| 23 | `23-common-audit-helper.md` | Helpers de auditoria e IP | Pendente |
| 24 | `24-common-decorators.md` | Decorators como `SkipAudit` | Pendente |

---

# 7. Módulos Administrativos e Operacionais

| Ordem | Arquivo | Tema | Status |
|---:|---|---|---|
| 25 | `25-users-visao-geral.md` | Módulo de usuários | Pendente |
| 26 | `26-users-controller.md` | Rotas `/users` | Pendente |
| 27 | `27-users-service.md` | Regras de usuários, matrícula e senha | Pendente |
| 28 | `28-users-dtos.md` | DTOs de usuários | Pendente |
| 29 | `29-users-regras-negocio.md` | Regra: somente ADMIN gerencia usuários | Pendente |
| 30 | `30-dashboard-visao-geral.md` | Indicadores administrativos | Pendente |
| 31 | `31-dashboard-controller-service.md` | Rotas e consultas do dashboard | Pendente |
| 32 | `32-audit-log-visao-geral.md` | Módulo de auditoria | Pendente |
| 33 | `33-audit-log-service.md` | Registro e consulta de auditoria | Pendente |
| 34 | `34-audit-log-cobertura.md` | Cobertura de auditoria por módulo | Pendente |

---

# 8. Beneficiários / Alunos

| Ordem | Arquivo | Tema | Status |
|---:|---|---|---|
| 35 | `35-beneficiaries-visao-geral.md` | Módulo de alunos/beneficiários | Pendente |
| 36 | `36-beneficiaries-controller.md` | Rotas `/beneficiaries` | Pendente |
| 37 | `37-beneficiaries-service.md` | Cadastro, status, histórico e regras | Pendente |
| 38 | `38-beneficiaries-importacao-xlsx.md` | Importação de planilha `.xlsx` | Pendente |
| 39 | `39-beneficiaries-exportacao.md` | Exportação de dados | Pendente |
| 40 | `40-beneficiaries-dtos.md` | DTOs e validações | Pendente |
| 41 | `41-beneficiaries-lgpd.md` | Dados sensíveis, LGPD, laudos e termos | Pendente |

---

# 9. Turmas, Matrículas e Frequências

| Ordem | Arquivo | Tema | Status |
|---:|---|---|---|
| 42 | `42-turmas-visao-geral.md` | Módulo de turmas/oficinas | Pendente |
| 43 | `43-turmas-controller.md` | Rotas `/turmas` | Pendente |
| 44 | `44-turmas-service.md` | Regras acadêmicas de turma | Pendente |
| 45 | `45-turmas-matriculas.md` | Matrícula e desmatrícula | Pendente |
| 46 | `46-turmas-grade-horaria.md` | Grade horária e conflitos | Pendente |
| 47 | `47-turmas-status.md` | Status acadêmico da turma | Pendente |
| 48 | `48-frequencias-visao-geral.md` | Módulo de frequências | Pendente |
| 49 | `49-frequencias-controller.md` | Rotas `/frequencias` | Pendente |
| 50 | `50-frequencias-service.md` | Registro individual e em lote | Pendente |
| 51 | `51-frequencias-diario.md` | Fechamento e reabertura de diário | Pendente |
| 52 | `52-frequencias-relatorios.md` | Relatórios de frequência | Pendente |
| 53 | `53-frequencias-campo-legado-presente.md` | Campo legado `presente` | Pendente |

---

# 10. Atestados e Laudos

| Ordem | Arquivo | Tema | Status |
|---:|---|---|---|
| 54 | `54-atestados-visao-geral.md` | Módulo de atestados | Pendente |
| 55 | `55-atestados-controller.md` | Rotas de atestados | Pendente |
| 56 | `56-atestados-service.md` | Justificativa automática de faltas | Pendente |
| 57 | `57-atestados-preview.md` | Preview de faltas justificáveis | Pendente |
| 58 | `58-laudos-visao-geral.md` | Módulo de laudos médicos | Pendente |
| 59 | `59-laudos-controller-service.md` | Rotas e regras de laudos | Pendente |
| 60 | `60-laudos-historico-exclusao.md` | Histórico documental e exclusão lógica | Pendente |

---

# 11. Comunicados, CMS e Contatos

| Ordem | Arquivo | Tema | Status |
|---:|---|---|---|
| 61 | `61-comunicados-visao-geral.md` | Mural de comunicados | Pendente |
| 62 | `62-comunicados-controller.md` | Rotas `/comunicados` | Pendente |
| 63 | `63-comunicados-service.md` | Regras de comunicado e capa | Pendente |
| 64 | `64-comunicados-cache.md` | Cache público por URL | Pendente |
| 65 | `65-site-config-visao-geral.md` | CMS da home pública | Pendente |
| 66 | `66-site-config-controller.md` | Rotas `/site-config` | Pendente |
| 67 | `67-site-config-cache.md` | Cache e invalidação do CMS | Pendente |
| 68 | `68-contatos-visao-geral.md` | Fale Conosco | Pendente |
| 69 | `69-contatos-controller-service.md` | Rotas e regras de mensagens | Pendente |

---

# 12. Uploads, Documentos e Certificados

| Ordem | Arquivo | Tema | Status |
|---:|---|---|---|
| 70 | `70-upload-visao-geral.md` | Módulo de upload | Pendente |
| 71 | `71-upload-controller.md` | Rotas `/upload` | Pendente |
| 72 | `72-upload-service.md` | Cloudinary, stream e exclusão | Pendente |
| 73 | `73-upload-seguranca-pastas.md` | Pastas permitidas no Cloudinary | Pendente |
| 74 | `74-certificados-visao-geral.md` | Módulo de certificados | Pendente |
| 75 | `75-certificados-controller.md` | Rotas `/modelos-certificados` | Pendente |
| 76 | `76-certificados-service.md` | Emissão acadêmica e honraria | Pendente |
| 77 | `77-certificados-pdf.md` | PDF-lib, arte base e assinatura | Pendente |
| 78 | `78-certificados-validacao-publica.md` | Código de validação pública | Pendente |
| 79 | `79-apoiadores-visao-geral.md` | Módulo de apoiadores | Pendente |
| 80 | `80-apoiadores-controller-service.md` | Rotas e regras de apoiadores | Pendente |
| 81 | `81-apoiadores-acoes-honrarias.md` | Ações e honrarias | Pendente |

---

# 13. Banco de Dados por Entidade

| Ordem | Arquivo | Entidade | Status |
|---:|---|---|---|
| 82 | `82-db-user.md` | `User` | Pendente |
| 83 | `83-db-user-session.md` | `UserSession` | Pendente |
| 84 | `84-db-aluno.md` | `Aluno` | Pendente |
| 85 | `85-db-turma.md` | `Turma` | Pendente |
| 86 | `86-db-matricula-oficina.md` | `MatriculaOficina` | Pendente |
| 87 | `87-db-grade-horaria.md` | `GradeHoraria` | Pendente |
| 88 | `88-db-frequencia.md` | `Frequencia` | Pendente |
| 89 | `89-db-atestado.md` | `Atestado` | Pendente |
| 90 | `90-db-laudo-medico.md` | `LaudoMedico` | Pendente |
| 91 | `91-db-comunicado.md` | `Comunicado` | Pendente |
| 92 | `92-db-mensagem-contato.md` | `MensagemContato` | Pendente |
| 93 | `93-db-site-config.md` | `SiteConfig` | Pendente |
| 94 | `94-db-conteudo-secao.md` | `ConteudoSecao` | Pendente |
| 95 | `95-db-audit-log.md` | `AuditLog` | Pendente |
| 96 | `96-db-apoiador.md` | `Apoiador` | Pendente |
| 97 | `97-db-acao-apoiador.md` | `AcaoApoiador` | Pendente |
| 98 | `98-db-modelo-certificado.md` | `ModeloCertificado` | Pendente |
| 99 | `99-db-certificado-emitido.md` | `CertificadoEmitido` | Pendente |

---

# 14. Rotas por Domínio

| Ordem | Arquivo | Tema | Status |
|---:|---|---|---|
| 100 | `100-rotas-auth.md` | Endpoints `/auth` | Pendente |
| 101 | `101-rotas-users.md` | Endpoints `/users` | Pendente |
| 102 | `102-rotas-beneficiaries.md` | Endpoints `/beneficiaries` | Pendente |
| 103 | `103-rotas-turmas.md` | Endpoints `/turmas` | Pendente |
| 104 | `104-rotas-frequencias.md` | Endpoints `/frequencias` | Pendente |
| 105 | `105-rotas-atestados.md` | Endpoints de atestados | Pendente |
| 106 | `106-rotas-upload.md` | Endpoints `/upload` | Pendente |
| 107 | `107-rotas-comunicados.md` | Endpoints `/comunicados` | Pendente |
| 108 | `108-rotas-site-config.md` | Endpoints `/site-config` | Pendente |
| 109 | `109-rotas-certificados.md` | Endpoints `/modelos-certificados` | Pendente |
| 110 | `110-rotas-contatos.md` | Endpoints de contatos | Pendente |
| 111 | `111-rotas-laudos.md` | Endpoints de laudos | Pendente |
| 112 | `112-rotas-apoiadores.md` | Endpoints de apoiadores | Pendente |
| 113 | `113-rotas-dashboard.md` | Endpoints de dashboard | Pendente |
| 114 | `114-rotas-audit-log.md` | Endpoints de auditoria | Pendente |

---

# 15. Integrações Externas e Bibliotecas

| Ordem | Arquivo | Integração | Status |
|---:|---|---|---|
| 115 | `115-integracao-cloudinary.md` | Cloudinary | Pendente |
| 116 | `116-integracao-prisma-postgresql.md` | Prisma + PostgreSQL | Pendente |
| 117 | `117-integracao-exceljs.md` | ExcelJS | Pendente |
| 118 | `118-integracao-pdf-lib.md` | PDF-lib | Pendente |
| 119 | `119-integracao-qrcode.md` | QRCode | Pendente |
| 120 | `120-integracao-dompurify-jsdom.md` | DOMPurify + JSDOM | Pendente |
| 121 | `121-integracao-cache-manager.md` | Cache Manager | Pendente |
| 122 | `122-integracao-throttler.md` | NestJS Throttler | Pendente |
| 123 | `123-integracao-bcrypt-jwt.md` | bcrypt + JWT | Pendente |

---

# 16. Qualidade, Performance e Operação

| Ordem | Arquivo | Tema | Status |
|---:|---|---|---|
| 124 | `124-testes-estrutura.md` | Jest, e2e e cobertura | Pendente |
| 125 | `125-qualidade-lint-format.md` | ESLint e Prettier | Pendente |
| 126 | `126-performance-cache.md` | Cache e TTLs | Pendente |
| 127 | `127-performance-uploads.md` | Payload, memória e arquivos | Pendente |
| 128 | `128-deploy-build-migrations.md` | Build separado de migrations | Pendente |
| 129 | `129-observabilidade-logs.md` | Logs, erros e auditoria | Pendente |
| 130 | `130-riscos-debitos-tecnicos.md` | Riscos e melhorias futuras | Pendente |

---

# 17. Critérios de Conclusão de Cada Arquivo

Cada arquivo documentado deve conter, quando aplicável:

- visão geral;
- responsabilidade;
- fluxo de funcionamento;
- padrões arquiteturais;
- justificativa técnica;
- dependências internas;
- dependências externas;
- variáveis relevantes;
- classes, funções e métodos;
- DTOs, interfaces e schemas;
- endpoints;
- banco de dados relacionado;
- segurança;
- qualidade;
- performance;
- regras de negócio;
- pontos de atenção;
- relação com outros módulos;
- resumo técnico final.

---

# 18. Histórico

| Data | Alteração |
|---|---|
| 2026-04-30 | Criação inicial da documentação backend |
| 2026-04-30 | Expansão do índice para documentação por módulo, rota, entidade, integração e camada técnica |

---

# 19. Próximo Arquivo

O próximo arquivo a ser criado é:

```txt
01-visao-geral-arquitetura.md
```

Esse arquivo deve documentar somente a visão geral arquitetural do backend. Depois dele, o índice deve ser atualizado marcando o item 01 como `Documentado`.
