# Modulo: Auth

---

# 1. Visao Geral

## Objetivo

Documentar `src/auth`, incluindo `AuthController`, `AuthService`, `AuthGuard`, `RolesGuard`, `Roles` decorator, DTOs e entidade placeholder.

## Responsabilidade

O modulo autentica usuarios internos, emite JWT, renova access tokens via refresh token, retorna perfil autenticado, permite troca de senha e atualizacao de perfil/foto.

## Fluxo de Funcionamento

O login recebe `username` e `senha`, busca usuario por username, compara bcrypt, valida status/exclusao, emite access token de 15 minutos e gera refresh token aleatorio. Rotas protegidas usam `AuthGuard`, que valida JWT e confirma no banco que a conta permanece ativa. `RolesGuard` verifica roles exigidas por `@Roles`.

---

# 2. Arquitetura e Metodologias

## Padroes Arquiteturais Identificados

* Guard Pattern.
* Decorator Pattern com `@Roles`.
* DTO Pattern.
* Service Layer.
* Select Projection para reduzir dados trafegados.
* Token Rotation parcial com refresh token persistido como hash.

## Justificativa Tecnica

Access token curto reduz janela de abuso. Refresh token com hash evita reutilizacao direta caso o banco seja exposto. A verificacao de status em tempo real no guard permite revogar acesso sem aguardar expiracao do JWT. DTOs limitam tamanho de senha e username, reduzindo risco de DoS por bcrypt.

---

# 3. Fluxo Interno do Codigo

## Fluxo de Execucao

1. `POST /api/auth/login` valida `LoginDto`.
2. `AuthService.login` consulta `User` com `AUTH_SELECT` mais `senha`.
3. Se usuario nao existir, compara senha contra `dummyHash` para equalizar tempo.
4. Rejeita credenciais invalidas, usuario excluido ou inativo.
5. Gera payload `{ sub, nome, role, precisaTrocarSenha }`.
6. Assina JWT com `JwtService`.
7. Gera refresh token com `crypto.randomBytes(40)` e armazena hash bcrypt.
8. `POST /api/auth/refresh` valida `RefreshTokenDto`, compara token bruto com hash e emite novo access token.
9. `GET /api/auth/me`, `PATCH /trocar-senha`, `PATCH /foto-perfil`, `PATCH /perfil` exigem `AuthGuard`.
10. `AuthGuard` extrai bearer token, verifica assinatura, consulta usuario ativo e injeta `request.user`.

## Dependencias Internas

* `PrismaService`
* `UploadService`
* `ApiResponse`
* `AuthenticatedRequest`
* `Roles` decorator

## Dependencias Externas

* `@nestjs/jwt`
* `@nestjs/config`
* `bcrypt`
* `node:crypto`
* `class-validator`
* `class-transformer`

---

# 4. Dicionario Tecnico

## Variaveis

* `AUTH_SELECT`: campos minimos para payload JWT.
* `PERFIL_SELECT`: campos retornados por perfil.
* `dummyHash`: hash bcrypt gerado no startup para mitigar timing attack.
* `access_token`: JWT curto.
* `refresh_token`: token bruto entregue ao cliente; apenas hash e salvo.
* `userId`: `sub` do JWT.
* `fotoPerfil`: URL opcional da foto.

## Funcoes e Metodos

* `login(loginDto)`: autentica usuario e retorna tokens.
* `refreshToken(userId, rawRefreshToken)`: renova access token.
* `trocarSenha(userId, dto)`: valida senha atual, grava nova senha forte e remove obrigacao de troca.
* `getMe(userId)`: retorna perfil seguro.
* `atualizarFotoPerfil(userId, fotoPerfil)`: troca URL e tenta remover arquivo antigo.
* `atualizarPerfil(userId, dto)`: atualiza nome/email e impede email duplicado.
* `AuthGuard.canActivate()`: valida token e conta ativa.
* `RolesGuard.canActivate()`: confere role no payload.
* `resolverUserId(req)`: extrai `req.user.sub` com fallback de erro.

## Classes

* `AuthController`: rotas HTTP de autenticacao e perfil.
* `AuthService`: regras de autenticacao.
* `AuthGuard`: autenticacao JWT.
* `RolesGuard`: autorizacao por papel.
* `LoginDto`, `RefreshTokenDto`, `TrocarSenhaDto`, `AtualizarFotoDto`, `AtualizarPerfilDto`.

## Interfaces e Tipagens

* `AuthenticatedUser`: `sub`, `role`, `nome`, `email`.
* `AuthenticatedRequest`: request Express com `user`.
* Roles Prisma: `ADMIN`, `SECRETARIA`, `PROFESSOR`, `COMUNICACAO`.

---

# 5. Servicos e Integracoes

## APIs

* `POST /api/auth/login`: publico; payload `{ username, senha }`; retorna access token, refresh token e usuario.
* `POST /api/auth/refresh`: publico; payload `{ userId, refreshToken }`; retorna novo access token.
* `GET /api/auth/me`: autenticado; retorna perfil.
* `PATCH /api/auth/trocar-senha`: autenticado; payload `{ senhaAtual, novaSenha }`.
* `PATCH /api/auth/foto-perfil`: autenticado; payload `{ fotoPerfil }`.
* `PATCH /api/auth/perfil`: autenticado; payload parcial `{ nome, email }`.

## Banco de Dados

Tabela `User`: `id`, `username`, `senha`, `role`, `statusAtivo`, `excluido`, `refreshToken`, `precisaTrocarSenha`, dados de perfil.

## Servicos Externos

* Cloudinary indiretamente via `UploadService.deleteFile` para remover foto antiga.

---

# 6. Seguranca e Qualidade

## Seguranca

* Bcrypt para senha e refresh token.
* Maximo de 72 caracteres para senha por limite efetivo do bcrypt.
* Senha forte em troca de senha.
* Mensagem generica no login.
* Anti timing attack com `dummyHash`.
* Revogacao imediata por verificacao de status no banco.
* `JwtModule.registerAsync` usa `ConfigService`; evita segredo undefined manual.
* `AtualizarPerfilDto` sanitiza null bytes e trim.

## Qualidade

* Selects minimos evitam retorno de senha e refresh token.
* Controller magro, service concentrando negocio.
* Erros HTTP semanticamente adequados: `Unauthorized`, `NotFound`, `BadRequest`.

## Performance

* `dummyHash` e criado uma vez no startup.
* JWT curto reduz carga de revogacao, mas `AuthGuard` faz consulta ao banco por request protegida.

---

# 7. Regras de Negocio

* Usuario excluido ou inativo nao autentica nem renova token.
* Toda troca de senha exige senha atual.
* Nova senha deve conter comprimento minimo, letras maiusculas/minusculas, numero e simbolo.
* Email de perfil nao pode pertencer a outro usuario.
* Foto antiga e removida de forma auxiliar; falha no Cloudinary nao bloqueia atualizacao.

---

# 8. Pontos de Atencao

* O refresh token nao possui expiracao persistida no schema; a politica de "7 dias" esta comentada, mas nao materializada em campo de data.
* `JwtModule` depende de `JWT_SECRET`; se ausente, a aplicacao deveria falhar no startup com validacao explicita de ambiente.
* Logout/revogacao explicita de refresh token nao aparece no controller.

---

# 9. Relacao com Outros Modulos

* `UsersService` cria usuarios que autenticam aqui.
* `UploadService` remove foto antiga.
* `AuditInterceptor` reconhece `/auth/login` como acao `LOGIN`.
* Todos os modulos internos usam `AuthGuard` e `RolesGuard`.

---

# 10. Resumo Tecnico Final

Auth e um modulo de criticidade alta. Ele protege dados pessoais, documentos medicos e operacoes administrativas. A implementacao demonstra boas praticas importantes contra timing attack, hash de refresh token e revogacao por status. Os principais riscos sao ausencia de expiracao persistida de refresh token e falta de validacao obrigatoria do `JWT_SECRET` no startup.

