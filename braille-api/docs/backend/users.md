# Modulo: Users

---

# 1. Visao Geral

## Objetivo

Documentar `src/users`, responsavel por funcionarios/usuarios internos.

## Responsabilidade

Criar, listar, atualizar, inativar, restaurar, reativar, resetar senha e arquivar logicamente usuarios do sistema.

## Fluxo de Funcionamento

Todas as rotas usam `AuthGuard` e `RolesGuard`. A maioria exige `ADMIN`; listagem permite roles internas. `UsersService` valida CPF, gera username e matricula, aplica senha padrao com hash bcrypt, registra auditoria e remove fotos antigas quando necessario.

---

# 2. Arquitetura e Metodologias

## Padroes Arquiteturais Identificados

* CRUD Service.
* Soft Delete.
* Factory helper para username/matricula.
* DTO Pattern.
* Audit Trail.
* Guard/Role-based Access Control.

## Justificativa Tecnica

Usuarios sao entidade sensivel por conter credenciais e autorizacao. A criacao automatizada de username e matricula padroniza operacao administrativa. Soft delete preserva historico e evita perda de relacionamentos com turmas, comunicados e auditoria.

---

# 3. Fluxo Interno do Codigo

## Fluxo de Execucao

1. `POST /api/users` recebe `CreateUserDto`.
2. Service verifica CPF unico.
3. Se CPF pertence a usuario ativo, retorna conflito; se pertence a inativo/excluido, retorna payload de reativacao.
4. Gera username por primeiro/ultimo nome, removendo acentos e colidindo com sufixo numerico.
5. Gera matricula staff com `gerarMatriculaStaff`.
6. Aplica `SENHA_PADRAO_USUARIO` ou fallback ofuscado.
7. Cria usuario com `precisaTrocarSenha=true`.
8. Registra auditoria `CRIAR`.
9. Atualizacao valida CPF duplicado, hasheia senha quando enviada e remove foto antiga se URL mudou.
10. Inativacao e hard delete logico impedem auto-desativacao/auto-exclusao.

## Dependencias Internas

* `PrismaService`
* `AuditLogService`
* `UploadService`
* `gerarMatriculaStaff`
* `getAuditUser`
* `AuthGuard`, `RolesGuard`, `Roles`

## Dependencias Externas

* `bcrypt`
* `@prisma/client`
* `class-validator`, `class-transformer`

---

# 4. Dicionario Tecnico

## Variaveis

* `SENHA_PADRAO`: senha inicial institucional.
* `username`: identificador login gerado.
* `matricula`: identificador institucional `PYYYYNNNNN`.
* `statusAtivo`: controla inativacao operacional.
* `excluido`: arquivamento profundo.
* `precisaTrocarSenha`: forca troca no primeiro login/reset.
* `fotoPerfil`: URL Cloudinary opcional.

## Funcoes e Metodos

* `gerarUsername(nome, prisma)`: cria username unico.
* `create(dto, auditUser)`: cria funcionario.
* `reativar(id, auditUser)`: reativa e reseta senha.
* `checkCpf(cpf)`: retorna status `livre`, `ativo`, `inativo` ou `excluido`.
* `findAll(query)`: lista usuarios com paginacao, filtro por nome, role e inativos.
* `update(id, dto, auditUser)`: atualiza dados e audita snapshot.
* `remove(id, auditUser)`: inativa usuario.
* `restore(id, auditUser)`: restaura `statusAtivo`.
* `resetPassword(id, auditUser)`: reseta para senha padrao e exige troca.
* `removeHard(id, auditUser)`: marca `excluido=true`.

## Classes

* `UsersController`: expõe rotas administrativas.
* `UsersService`: regra de negocio.
* `CreateUserDto`: `nome`, `cpf`, `role`, `email`, contato/endereco.
* `UpdateUserDto`: partial de create, senha forte opcional e foto.
* `QueryUserDto`: paginacao, nome, inativos e role.

## Interfaces e Tipagens

* `Role` do Prisma.
* `AuditUser`.
* Entidade `User` do schema Prisma.

---

# 5. Servicos e Integracoes

## APIs

* `POST /api/users`: ADMIN cria funcionario.
* `GET /api/users`: roles internas listam usuarios.
* `GET /api/users/check-cpf`: ADMIN valida CPF.
* `PATCH /api/users/:id`: ADMIN atualiza.
* `POST /api/users/:id/reativar`: ADMIN reativa.
* `DELETE /api/users/:id`: ADMIN inativa.
* `PATCH /api/users/:id/reset-password`: ADMIN reseta senha.
* `PATCH /api/users/:id/restore`: ADMIN restaura.
* `DELETE /api/users/:id/hard`: ADMIN arquiva logicamente.

## Banco de Dados

Tabela `User`, com indices por `statusAtivo/excluido`, `role`, `cpf`, `email`.

## Servicos Externos

Cloudinary via `UploadService.deleteFile` para remocao de foto antiga.

---

# 6. Seguranca e Qualidade

## Seguranca

* Rotas mutaveis restritas a `ADMIN`.
* Senhas sempre gravadas com bcrypt.
* Reset e inativacao bloqueiam autoacao para evitar self-lock/root reset.
* Senha padrao força troca no login.
* Auditoria omite senha nos snapshots.

## Qualidade

* Selects de listagem omitem senha.
* Erros internos sao logados e retornam mensagens genericas.
* Fluxo de reativacao evita duplicar CPF.

## Performance

* `findAll` usa `Promise.all` para lista e count.
* Campos selecionados reduzem payload.

---

# 7. Regras de Negocio

* CPF e obrigatorio e unico para funcionario.
* Usuario ativo com CPF existente nao pode ser recriado.
* Usuario inativo/excluido com CPF existente deve seguir fluxo de reativacao.
* Username deriva do nome e recebe sufixo numerico em colisao.
* Usuario logado nao pode desativar/excluir/resetar a propria conta por rotas administrativas.

---

# 8. Pontos de Atencao

* `SENHA_PADRAO` tem fallback no codigo; idealmente ambiente deveria ser obrigatorio em producao.
* `role` em query e string, convertida no service; validacao poderia usar enum.
* Existe arquivo duplicado em `src/users/dto/rc/users/dto/query-user.dto.ts`, provavel residuo.

---

# 9. Relacao com Outros Modulos

* `Auth` autentica usuarios criados aqui.
* `Turmas` referencia professores por `User`.
* `Comunicados` referencia autor `User`.
* `AuditLog` armazena snapshots de mudancas.
* `Upload` gerencia foto.

---

# 10. Resumo Tecnico Final

Users e modulo critico por controlar identidade interna e acesso operacional. A complexidade e media, com regras de credencial, reativacao, auditoria e soft delete. O principal risco e a politica de senha padrao depender de configuracao e processo operacional seguro.

