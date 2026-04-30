# Modulo: Auth

---

# 1. Visao Geral

## Objetivo

Documentar `src/auth`, incluindo `AuthController`, `AuthService`, `AuthGuard`, `RolesGuard`, `Roles` decorator, DTOs e entidade placeholder.

## Responsabilidade

O modulo autentica usuarios internos, emite JWT, renova access tokens via refresh token, retorna perfil autenticado, permite troca de senha e atualizacao de perfil/foto.

## Fluxo de Funcionamento

O login recebe `username` e `senha`, busca usuario por username, compara bcrypt, valida status/exclusao, emite access token de 15 minutos e cria uma sessao persistida em `UserSession` com refresh token opaco. Rotas protegidas usam `AuthGuard`, que valida JWT e confirma no banco que a conta permanece ativa. `RolesGuard` verifica roles exigidas por `@Roles`.

---

# 2. Arquitetura e Metodologias

## Padroes Arquiteturais Identificados

* Guard Pattern.
* Decorator Pattern com `@Roles`.
* DTO Pattern.
* Service Layer.
* Select Projection para reduzir dados trafegados.
* Token Rotation com refresh token persistido por sessao.

## Justificativa Tecnica

Access token curto reduz janela de abuso. Refresh token com hash em `UserSession` evita reutilizacao direta caso o banco seja exposto e permite revogacao por sessao. A verificacao de status em tempo real no guard permite revogar acesso sem aguardar expiracao do JWT. DTOs limitam tamanho de senha e username, reduzindo risco de DoS por bcrypt.

---

# 3. Fluxo Interno do Codigo

## Fluxo de Execucao

1. `POST /api/auth/login` valida `LoginDto`.
2. `AuthService.login` consulta `User` com `AUTH_SELECT` mais `senha`.
3. Se usuario nao existir, compara senha contra `dummyHash` para equalizar tempo.
4. Rejeita credenciais invalidas, usuario excluido ou inativo.
5. Cria sessao `UserSession` com hash do segredo, expiracao de 7 dias, IP/user-agent quando disponiveis e limpa colunas legadas em `User`.
6. Assina JWT com `JwtService`.
7. Gera payload `{ sub, nome, role, precisaTrocarSenha, sid }`.
8. Retorna refresh token opaco no formato `sessionId.secret`.
9. `POST /api/auth/refresh` valida `RefreshTokenDto`, localiza a sessao, compara segredo bruto com hash, rotaciona o refresh token e emite novo access token.
10. `GET /api/auth/me`, `PATCH /trocar-senha`, `PATCH /foto-perfil`, `PATCH /perfil` exigem `AuthGuard`.
11. `AuthGuard` extrai bearer token, verifica assinatura, consulta usuario ativo e injeta `request.user`.

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
* `refresh_token`: token opaco entregue ao cliente no formato `sessionId.secret`; apenas hash do segredo e salvo.
* `sid`: identificador da sessao no payload JWT.
* `userId`: `sub` do JWT.
* `fotoPerfil`: URL opcional da foto.

## Funcoes e Metodos

* `login(loginDto)`: autentica usuario e retorna tokens.
* `refreshToken(rawRefreshToken)`: valida sessao, rotaciona refresh token e renova access token.
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
* `POST /api/auth/refresh`: publico; payload `{ refreshToken }`; retorna novo access token e novo refresh token.
* `GET /api/auth/me`: autenticado; retorna perfil.
* `PATCH /api/auth/trocar-senha`: autenticado; payload `{ senhaAtual, novaSenha }`.
* `PATCH /api/auth/foto-perfil`: autenticado; payload `{ fotoPerfil }`.
* `PATCH /api/auth/perfil`: autenticado; payload parcial `{ nome, email }`.

## Banco de Dados

Tabela `User`: `id`, `username`, `senha`, `role`, `statusAtivo`, `excluido`, `precisaTrocarSenha`, dados de perfil e colunas legadas de refresh limpas durante a transicao.
Tabela `UserSession`: `id`, `userId`, `refreshTokenHash`, `expiresAt`, `revokedAt`, `userAgent`, `ip`, `criadoEm`, `atualizadoEm`.

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
* Revogacao imediata por verificacao de status no banco e por `revokedAt` na sessao.
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
* Refresh token expirado ou invalido revoga a sessao.
* Refresh token valido e rotacionado a cada renovacao.
* Toda troca de senha exige senha atual.
* Nova senha deve conter comprimento minimo, letras maiusculas/minusculas, numero e simbolo.
* Email de perfil nao pode pertencer a outro usuario.
* Foto antiga e removida de forma auxiliar; falha no Cloudinary nao bloqueia atualizacao.

---

# 8. Pontos de Atencao Tratados

* A expiracao do refresh token agora esta materializada em `UserSession.expiresAt` com politica de 7 dias, sendo validada durante `auth.service.ts/refreshToken`.
* O `JwtModule` agora é protegido no startup da aplicação por intermédio da função `obterJwtSecretObrigatorio` (em `auth.module.ts`), que interrompe a subida do servidor caso o `JWT_SECRET` não esteja configurado, prevenindo falhas de segurança silenciosas.
* A rota oficial de logout (`POST /api/auth/logout`) ja esta exposta e documentada via Swagger no `AuthController`, encarregando-se de revogar sessoes persistidas do usuario logado.
* O controller e os testes foram alinhados ao novo contrato de refresh sem `userId` no payload.

---

# 9. Relacao com Outros Modulos

* `UsersService` cria usuarios que autenticam aqui.
* `UploadService` remove foto antiga.
* `AuditInterceptor` reconhece `/auth/login` como acao `LOGIN`.
* Todos os modulos internos usam `AuthGuard` e `RolesGuard`.

---

# 10. Resumo Tecnico Final

Auth é um módulo de criticidade alta. Ele protege dados pessoais, documentos médicos e operações administrativas. A implementação demonstra boas práticas importantes contra timing attack, hash de refresh token e revogação por status. Os riscos anteriores foram todos mitigados com as últimas refatorações, que incluíram a validação obrigatória do `JWT_SECRET` no startup do NestJS e a persistência real da data de expiração do Refresh Token na tabela, tornando a infraestrutura de segurança muito confiável.
