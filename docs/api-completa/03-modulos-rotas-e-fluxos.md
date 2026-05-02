# 03 — Módulos, Rotas e Fluxos

---

## 1. Objetivo

Este documento mapeia os módulos da Braille API, suas responsabilidades, rotas principais e fluxos de execução relevantes.

A documentação não substitui o Swagger nem o código, mas serve como guia técnico para entendimento rápido da aplicação.

---

## 2. Módulos Principais

| Módulo | Pasta | Responsabilidade |
|---|---|---|
| `AuthModule` | `src/auth` | Login, JWT, refresh token, logout, perfil e troca de senha. |
| `UsersModule` | `src/users` | Gestão de funcionários/staff. |
| `BeneficiariesModule` | `src/beneficiaries` | Gestão de alunos/beneficiários. |
| `TurmasModule` | `src/turmas` | Oficinas, turmas, grade horária e matrículas. |
| `FrequenciasModule` | `src/frequencias` | Chamadas, frequência, relatórios e diário. |
| `AtestadosModule` | `src/atestados` | Justificativas de falta por atestado. |
| `LaudosModule` | `src/laudos` | Histórico de laudos médicos. |
| `UploadModule` | `src/upload` | Upload e exclusão de arquivos no Cloudinary. |
| `CertificadosModule` | `src/certificados` | Modelos, emissão e validação de certificados. |
| `ApoiadoresModule` | `src/apoiadores` | Gestão de apoiadores e honrarias. |
| `ComunicadosModule` | `src/comunicados` | Comunicados/notícias públicas. |
| `ContatosModule` | `src/contatos` | Mensagens do Fale Conosco. |
| `DashboardModule` | `src/dashboard` | Indicadores administrativos. |
| `SiteConfigModule` | `src/site-config` | Configurações e conteúdo do site público. |
| `AuditLogModule` | `src/audit-log` | Registro e consulta de auditoria. |
| `PrismaModule` | `src/prisma` | Acesso ao banco. |
| `Common` | `src/common` | Recursos transversais. |

---

## 3. Rotas de Autenticação

Prefixo: `/api/auth`

| Método | Rota | Proteção | O que faz |
|---|---|---|---|
| `POST` | `/auth/login` | Pública | Autentica usuário e retorna access token + refresh token. |
| `POST` | `/auth/refresh` | Pública com refresh token | Renova access token e rotaciona refresh token. |
| `POST` | `/auth/logout` | `AuthGuard` | Revoga sessão atual. |
| `GET` | `/auth/me` | `AuthGuard` | Retorna perfil do usuário logado. |
| `PATCH` | `/auth/trocar-senha` | `AuthGuard` | Troca a própria senha. |
| `PATCH` | `/auth/foto-perfil` | `AuthGuard` | Atualiza URL da foto de perfil. |
| `PATCH` | `/auth/perfil` | `AuthGuard` | Atualiza nome/e-mail do perfil. |

### Fluxo de login

```txt
POST /auth/login
  ↓
AuthController.login
  ↓
AuthService.login
  ↓
Busca usuário por username
  ↓
Compara senha com bcrypt
  ↓
Valida statusAtivo e excluido
  ↓
Cria UserSession com refresh token hash
  ↓
Gera JWT com sid
  ↓
Retorna access_token, refresh_token e usuário
```

---

## 4. Rotas de Usuários

Prefixo: `/api/users`

Todas exigem `AuthGuard`, `RolesGuard` e role `ADMIN`.

| Método | Rota | O que faz |
|---|---|---|
| `POST` | `/users` | Cria funcionário com username, matrícula e senha padrão. |
| `GET` | `/users` | Lista usuários com filtros e paginação. |
| `GET` | `/users/resumo` | Lista dados mínimos de usuários. |
| `GET` | `/users/check-cpf` | Verifica existência de CPF. |
| `PATCH` | `/users/:id` | Atualiza dados de usuário. |
| `POST` | `/users/:id/reativar` | Reativa usuário e gera nova senha padrão. |
| `DELETE` | `/users/:id` | Inativa usuário. |
| `PATCH` | `/users/:id/reset-password` | Reseta senha de outro usuário. |
| `PATCH` | `/users/:id/restore` | Restaura usuário inativo. |
| `DELETE` | `/users/:id/hard` | Arquiva logicamente usuário. |

### Fluxo de criação de usuário

```txt
POST /users
  ↓
Valida role ADMIN
  ↓
UsersService.create
  ↓
Verifica CPF duplicado
  ↓
Gera username único
  ↓
Gera matrícula staff
  ↓
Hash da senha padrão
  ↓
Cria User
  ↓
Registra auditoria
  ↓
Retorna dados + credenciais temporárias
```

---

## 5. Rotas de Beneficiários/Alunos

Prefixo: `/api/beneficiaries`

| Método | Rota | Permissão | O que faz |
|---|---|---|---|
| `POST` | `/beneficiaries` | `ADMIN`, `SECRETARIA` | Cadastra aluno. |
| `POST` | `/beneficiaries/import` | `ADMIN`, `SECRETARIA` | Importa alunos por XLSX. |
| `GET` | `/beneficiaries` | Autenticado | Lista alunos. |
| `GET` | `/beneficiaries/check-cpf-rg` | `ADMIN`, `SECRETARIA` | Verifica CPF/RG. |
| `GET` | `/beneficiaries/export` | `ADMIN`, `SECRETARIA` | Exporta XLSX. |
| `GET` | `/beneficiaries/:id` | Autenticado | Busca aluno por ID. |
| `PATCH` | `/beneficiaries/:id` | `ADMIN`, `SECRETARIA` | Atualiza aluno. |
| `DELETE` | `/beneficiaries/:id` | `ADMIN`, `SECRETARIA` | Inativa aluno. |
| `POST` | `/beneficiaries/:id/reactivate` | `ADMIN`, `SECRETARIA` | Reativa aluno. |
| `PATCH` | `/beneficiaries/:id/restore` | `ADMIN`, `SECRETARIA` | Restaura aluno. |
| `DELETE` | `/beneficiaries/:id/hard` | `ADMIN`, `SECRETARIA` | Arquiva logicamente. |

### Fluxo de cadastro de aluno

```txt
POST /beneficiaries
  ↓
Valida ADMIN/SECRETARIA
  ↓
Normaliza CPF/RG
  ↓
Verifica duplicidade
  ↓
Gera matrícula de aluno
  ↓
Cria Aluno
  ↓
Registra auditoria
  ↓
Retorna aluno criado
```

---

## 6. Rotas de Turmas

Prefixo: `/api/turmas`

| Método | Rota | Permissão | O que faz |
|---|---|---|---|
| `POST` | `/turmas` | `ADMIN`, `SECRETARIA` | Cria turma. |
| `GET` | `/turmas` | `ADMIN`, `SECRETARIA`, `PROFESSOR` | Lista turmas com cache. |
| `GET` | `/turmas/professores-ativos` | Autenticado | Lista professores com turmas. |
| `GET` | `/turmas/:id/alunos-disponiveis` | `ADMIN`, `SECRETARIA` | Lista alunos sem conflito de horário. |
| `GET` | `/turmas/:id` | Autenticado | Busca turma com alunos. |
| `PATCH` | `/turmas/:id` | `ADMIN`, `SECRETARIA` | Atualiza turma. |
| `PATCH` | `/turmas/:id/status` | `ADMIN`, `SECRETARIA` | Muda status acadêmico. |
| `DELETE` | `/turmas/:id` | `ADMIN`, `SECRETARIA` | Arquiva turma. |
| `PATCH` | `/turmas/:id/restaurar` | `ADMIN`, `SECRETARIA` | Restaura turma. |
| `PATCH` | `/turmas/:id/ocultar` | `ADMIN`, `SECRETARIA` | Oculta turma. |
| `POST` | `/turmas/:id/alunos/:alunoId` | `ADMIN`, `SECRETARIA` | Matricula aluno. |
| `DELETE` | `/turmas/:id/alunos/:alunoId` | `ADMIN`, `SECRETARIA` | Cancela matrícula. |
| `PATCH` | `/turmas/:id/cancelar` | `ADMIN`, `SECRETARIA` | Cancela turma. |
| `PATCH` | `/turmas/:id/concluir` | `ADMIN`, `SECRETARIA` | Conclui turma. |

### Fluxo de matrícula em turma

```txt
POST /turmas/:id/alunos/:alunoId
  ↓
Valida ADMIN/SECRETARIA
  ↓
Busca turma e aluno
  ↓
Verifica matrícula ativa duplicada
  ↓
Verifica capacidade máxima
  ↓
Verifica conflito de horário do aluno
  ↓
Cria MatriculaOficina
  ↓
Registra auditoria
```

---

## 7. Rotas de Frequências

Prefixo: `/api/frequencias`

| Método | Rota | Permissão | O que faz |
|---|---|---|---|
| `POST` | `/frequencias` | `ADMIN`, `SECRETARIA`, `PROFESSOR` | Registra chamada individual. |
| `POST` | `/frequencias/lote` | `ADMIN`, `SECRETARIA`, `PROFESSOR` | Salva chamada em lote. |
| `GET` | `/frequencias` | Autenticado | Lista chamadas. |
| `GET` | `/frequencias/resumo` | Autenticado | Lista resumo por turma/data. |
| `GET` | `/frequencias/relatorio/turma/:turmaId/aluno/:alunoId` | Autenticado | Relatório de presença do aluno. |
| `GET` | `/frequencias/:id` | Autenticado | Busca chamada. |
| `PATCH` | `/frequencias/:id` | Autenticado | Edita chamada. |
| `DELETE` | `/frequencias/:id` | `ADMIN`, `SECRETARIA` | Remove chamada. |
| `POST` | `/frequencias/diario/fechar/:turmaId/:dataAula` | Autenticado | Fecha diário. |
| `POST` | `/frequencias/diario/reabrir/:turmaId/:dataAula` | `ADMIN`, `SECRETARIA` | Reabre diário. |

---

## 8. Rotas de Atestados

Prefixos mistos:

- `/api/alunos/:alunoId/atestados`
- `/api/atestados/:id`

| Método | Rota | Permissão | O que faz |
|---|---|---|---|
| `POST` | `/alunos/:alunoId/atestados` | Autenticado | Cria atestado e justifica faltas. |
| `GET` | `/alunos/:alunoId/atestados` | Autenticado | Lista atestados do aluno. |
| `GET` | `/alunos/:alunoId/atestados/preview` | Autenticado | Simula faltas justificáveis. |
| `GET` | `/atestados/:id` | Autenticado | Detalha atestado. |
| `PATCH` | `/atestados/:id` | Autenticado | Atualiza motivo/arquivo. |
| `DELETE` | `/atestados/:id` | `ADMIN`, `SECRETARIA` | Remove atestado e reverte faltas. |

---

## 9. Rotas de Laudos

| Método | Rota | Permissão | O que faz |
|---|---|---|---|
| `POST` | `/alunos/:alunoId/laudos` | `ADMIN`, `SECRETARIA` | Anexa laudo. |
| `GET` | `/alunos/:alunoId/laudos` | `ADMIN`, `SECRETARIA`, `PROFESSOR` | Lista laudos ativos. |
| `PATCH` | `/laudos/:id` | `ADMIN`, `SECRETARIA` | Atualiza metadados. |
| `DELETE` | `/laudos/:id` | `ADMIN`, `SECRETARIA` | Exclusão lógica do laudo. |

---

## 10. Rotas de Upload

Prefixo: `/api/upload`

| Método | Rota | Permissão | O que faz |
|---|---|---|---|
| `POST` | `/upload` | `ADMIN`, `COMUNICACAO` | Upload institucional de imagem/PDF. |
| `DELETE` | `/upload?url=` | `ADMIN`, `SECRETARIA`, `COMUNICACAO` | Exclui arquivo do Cloudinary. |
| `POST` | `/upload/pdf?tipo=lgpd|atestado|laudo` | `ADMIN`, `SECRETARIA` | Upload de documento. |

---

## 11. Rotas de Certificados

Prefixos:

- `/api/modelos-certificados`
- `/api/certificados`

| Método | Rota | Permissão | O que faz |
|---|---|---|---|
| `POST` | `/modelos-certificados/emitir-academico` | `ADMIN`, `SECRETARIA`, `PROFESSOR` | Emite certificado acadêmico. |
| `POST` | `/modelos-certificados/emitir-honraria` | `ADMIN`, `SECRETARIA` | Emite honraria em PDF. |
| `POST` | `/modelos-certificados` | `ADMIN`, `SECRETARIA` | Cria modelo. |
| `GET` | `/modelos-certificados` | Autenticado | Lista modelos. |
| `GET` | `/modelos-certificados/:id` | Autenticado | Busca modelo. |
| `PATCH` | `/modelos-certificados/:id` | `ADMIN`, `SECRETARIA` | Atualiza modelo. |
| `DELETE` | `/modelos-certificados/:id` | `ADMIN`, `SECRETARIA` | Remove modelo. |
| `GET` | `/certificados/validar/:codigo` | Pública | Valida certificado. |

---

## 12. Fluxo de Emissão de Certificado Acadêmico

```txt
POST /modelos-certificados/emitir-academico
  ↓
Valida role ADMIN/SECRETARIA/PROFESSOR
  ↓
Busca turma com modelo e matrícula do aluno
  ↓
Valida se turma ou matrícula está CONCLUIDA
  ↓
Verifica se modelo existe
  ↓
Verifica frequência mínima quando há registros
  ↓
Verifica cache de certificado já emitido
  ↓
Busca aluno com select mínimo
  ↓
Substitui tags no template
  ↓
Gera PDF
  ↓
Faz upload do PDF para Cloudinary
  ↓
Cria ou atualiza CertificadoEmitido
  ↓
Retorna pdfUrl e codigoValidacao
```

---

## 13. Observação sobre Swagger

A API possui Swagger configurado. A documentação desta pasta deve ser usada para entender regras e arquitetura. O Swagger deve ser usado para testar payloads e consultar contratos HTTP atuais.
