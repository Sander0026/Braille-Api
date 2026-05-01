# 12 — AuthService (`src/auth/auth.service.ts`)

---

# 1. Visão Geral

## Objetivo

Documentar o `AuthService`, serviço central do módulo de autenticação da Braille API.

O `AuthService` contém as regras de negócio de login, refresh token, logout, troca de senha, perfil, atualização de foto e atualização de dados básicos do usuário logado.

## Responsabilidade

Responsabilidades principais:

- validar credenciais de usuário;
- mitigar timing attack em login;
- validar usuário ativo e não excluído;
- criar sessão persistente em `UserSession`;
- gerar access token JWT;
- gerar refresh token opaco;
- armazenar apenas hash do refresh token;
- rotacionar refresh token;
- detectar reuso real do refresh token anterior;
- revogar sessões;
- trocar senha;
- atualizar perfil e foto;
- remover foto antiga via `UploadService`.

## Fluxo de Funcionamento

```txt
login()
  ↓
Busca User por username
  ↓
Compara senha com bcrypt ou dummyHash
  ↓
Valida status
  ↓
Cria UserSession
  ↓
Gera JWT
  ↓
Retorna tokens e usuário básico
```

```txt
refreshToken()
  ↓
parseRefreshToken()
  ↓
buscarSessaoRefresh()
  ↓
Valida expiração/revogação/usuário
  ↓
Compara secret com hash atual
  ↓
Rotaciona ou detecta reuso
  ↓
Retorna novos tokens
```

---

# 2. Arquitetura e Metodologias

## Padrões Arquiteturais Identificados

- Service Layer;
- Security Service Pattern;
- Refresh Token Rotation;
- Session Table Pattern;
- Select Mínimo;
- Defensive Programming;
- Hash-based Token Storage;
- Dependency Injection.

## Justificativa Técnica

O service concentra lógica sensível para evitar que regras de autenticação fiquem espalhadas em controllers ou guards.

O uso de `UserSession` permite múltiplas sessões por usuário, logout por dispositivo e revogação seletiva.

O uso de hash para refresh token reduz impacto de vazamento do banco. O refresh token bruto só existe no cliente e durante o processamento da requisição.

---

# 3. Fluxo Interno do Código

## Dependências Injetadas

| Dependência | Uso |
|---|---|
| `JwtService` | Assinar JWT |
| `PrismaService` | Acessar `User` e `UserSession` |
| `UploadService` | Excluir foto antiga de perfil |

## Constantes e Selects

| Estrutura | Objetivo |
|---|---|
| `AUTH_SELECT` | Campos mínimos para autenticação e JWT |
| `PERFIL_SELECT` | Campos retornados no perfil público |
| `REFRESH_TOKEN_TTL_DIAS` | Duração do refresh token em dias |
| `REFRESH_TOKEN_TTL_MS` | Duração convertida em ms |
| `dummyHash` | Hash falso para normalizar tempo do login |

## Métodos Principais

### `login()`

Responsável por:

- buscar usuário por `username`;
- comparar senha com bcrypt;
- usar `dummyHash` se usuário não existir;
- rejeitar credenciais inválidas com mensagem genérica;
- rejeitar usuário excluído ou inativo;
- criar sessão de refresh token;
- gerar access token com `sid`;
- retornar tokens e usuário básico.

### `refreshToken()`

Responsável por:

- validar formato do refresh token;
- buscar sessão;
- validar revogação;
- validar expiração;
- validar usuário ativo e não excluído;
- comparar segredo com hash atual;
- comparar com hash anterior se o atual não bater;
- revogar sessão em caso de reuso real;
- rotacionar refresh token;
- emitir novo JWT.

### `logout()`

Responsável por:

- revogar sessão atual quando `sessionId` existe;
- revogar todas as sessões do usuário quando `sessionId` não existe;
- retornar `ApiResponse<null>`.

### `trocarSenha()`

Responsável por:

- buscar senha atual do usuário;
- validar senha atual com bcrypt;
- gerar hash da nova senha;
- atualizar senha;
- marcar `precisaTrocarSenha` como `false`.

### `getMe()`

Retorna dados públicos do perfil usando `PERFIL_SELECT`.

### `atualizarFotoPerfil()`

Atualiza a foto do usuário. Se houver foto antiga e a nova for diferente, tenta remover o arquivo antigo via `UploadService.deleteFile()`.

### `atualizarPerfil()`

Atualiza nome e e-mail. Antes de alterar e-mail, verifica se outro usuário já usa o mesmo e-mail.

## Métodos Privados de Sessão

| Método | Responsabilidade |
|---|---|
| `gerarAccessToken()` | Assinar JWT com `sub`, `nome`, `role`, `precisaTrocarSenha` e `sid` |
| `criarSessaoRefreshToken()` | Criar sessão no banco e limpar campos legados do usuário |
| `rotacionarSessaoRefreshToken()` | Salvar hash anterior e novo hash atual |
| `buscarSessaoRefresh()` | Buscar sessão e usuário relacionado |
| `gerarRefreshTokenSeguro()` | Gerar `sessionId.secret` e hash bcrypt |
| `compararSegredoRefresh()` | Comparar secret com hash |
| `parseRefreshToken()` | Validar e separar token opaco |
| `isUuidV4()` | Validar UUID v4 |
| `calcularExpiracaoRefreshToken()` | Calcular expiração de 7 dias |
| `revogarSessao()` | Marcar sessão como revogada |
| `revogarTodasSessoesDoUsuario()` | Revogar todas as sessões ativas do usuário |

---

# 4. Dicionário Técnico

## Variáveis

| Nome | Tipo | Objetivo |
|---|---|---|
| `logger` | `Logger` | Registrar alertas, como falha ao remover foto antiga |
| `dummyHash` | string | Mitigar timing attack |
| `rawSecret` | string | Segredo bruto do refresh token |
| `hashedRefreshToken` | string | Hash persistido no banco |
| `refreshTokenExpiraEm` | Date | Expiração do refresh token |
| `rawRefreshToken` | string | Token enviado ao cliente |
| `sessionId` | string | ID da sessão |
| `secret` | string | Parte secreta do refresh token |

## Interfaces

| Interface | Objetivo |
|---|---|
| `SessionMetadata` | Transportar IP e user agent |
| `RefreshTokenPair` | Retornar token bruto, hash, sessão e expiração |

---

# 5. Serviços e Integrações

## APIs Consumidoras

O service é chamado por:

- `POST /auth/login`;
- `POST /auth/refresh`;
- `POST /auth/logout`;
- `GET /auth/me`;
- `PATCH /auth/trocar-senha`;
- `PATCH /auth/foto-perfil`;
- `PATCH /auth/perfil`.

## Banco de Dados

Models utilizados:

- `User`;
- `UserSession`.

## Serviços Externos

- JWT via `JwtService`;
- bcrypt para senha e token;
- crypto para UUID e segredo;
- Cloudinary indiretamente por `UploadService`.

---

# 6. Segurança e Qualidade

## Segurança

- senha comparada com bcrypt;
- refresh token salvo apenas como hash;
- refresh token rotacionado;
- hash anterior usado para detectar reuso;
- usuário excluído/inativo não renova sessão;
- sessão expirada é revogada;
- access token contém `sid`;
- select mínimo evita dados desnecessários;
- `dummyHash` reduz enumeração por timing;
- e-mail duplicado é bloqueado na atualização de perfil.

## Qualidade

- métodos pequenos e segmentados;
- separação entre fluxo público e métodos privados;
- baixo acoplamento com controller;
- uso de DTOs no controller;
- retorno padronizado com `ApiResponse` em operações de perfil/logout.

## Performance

- bcrypt tem custo controlado;
- consultas usam selects mínimos;
- sessão é buscada por ID;
- rotação atualiza apenas a sessão correspondente.

---

# 7. Regras de Negócio

- usuário só loga se estiver ativo e não excluído;
- login inválido não revela se usuário existe;
- cada login cria uma nova sessão;
- refresh token expira em 7 dias;
- access token expira conforme configuração do `JwtModule`;
- refresh válido sempre rotaciona token;
- refresh expirado revoga sessão;
- refresh de usuário inativo ou excluído revoga sessão;
- reuso do refresh token anterior revoga sessão;
- token aleatório inválido não revoga sessão;
- troca de senha exige senha atual correta;
- troca de senha remove necessidade de troca obrigatória;
- e-mail de perfil deve ser único entre usuários.

---

# 8. Pontos de Atenção

- campos legados `refreshToken` e `refreshTokenExpiraEm` ainda existem em `User`;
- limpeza de sessões expiradas ainda pode virar job agendado;
- refresh com bcrypt pode pesar sob carga elevada;
- troca de senha ainda não revoga automaticamente outras sessões;
- remoção de foto antiga falha de forma tolerante, registrando warning.

---

# 9. Relação com Outros Módulos

| Módulo | Relação |
|---|---|
| `AuthController` | Chama os métodos públicos |
| `PrismaService` | Acesso a `User` e `UserSession` |
| `UploadService` | Exclusão de foto antiga |
| `AuthGuard` | Valida JWT gerado pelo service |
| `RolesGuard` | Usa role presente no JWT |
| `UsersModule` | Gerencia os usuários autenticáveis |

---

# 10. Resumo Técnico Final

O `AuthService` é o núcleo de segurança do backend. Ele implementa autenticação, sessão, refresh token rotativo, revogação e perfil.

Criticidade: muito alta.

Complexidade: alta.

A implementação atual é profissional e segura, com principal atenção futura para remoção de campos legados, limpeza de sessões antigas, testes e2e e política de revogação após troca de senha.
