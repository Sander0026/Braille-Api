# 13 — Auth: Refresh Token e Sessões (`UserSession`)

---

# 1. Visão Geral

## Objetivo

Documentar a arquitetura de sessões e refresh token da Braille API.

Este documento aprofunda o fluxo de `UserSession`, formato do refresh token, rotação, revogação, expiração e detecção de reuso real do token anterior.

## Responsabilidade

A estratégia de sessão é responsável por:

- criar uma sessão por login;
- emitir refresh token opaco;
- armazenar somente hash do segredo;
- vincular access token à sessão por `sid`;
- renovar access token sem novo login;
- rotacionar refresh token a cada uso;
- revogar sessão no logout;
- detectar reuso do refresh token anterior;
- evitar revogar sessão quando chega token aleatório inválido.

## Fluxo de Funcionamento

```txt
Login
  ↓
gerarRefreshTokenSeguro()
  ↓
cria UserSession
  ↓
JWT recebe sid
  ↓
cliente recebe access_token e refresh_token
```

```txt
Refresh
  ↓
parse sessionId.secret
  ↓
busca UserSession
  ↓
valida expiração, revogação e usuário
  ↓
compara secret com hash atual
  ↓
se válido: salva hash atual como anterior e grava novo hash
  ↓
se secret bater com hash anterior: revoga sessão
```

---

# 2. Arquitetura e Metodologias

## Padrões Arquiteturais Identificados

- Refresh Token Rotation;
- Session Table Pattern;
- Opaque Token Pattern;
- Hash-based Token Storage;
- Replay Detection;
- Device/session-level Revocation;
- Backward Compatibility com campos legados.

## Justificativa Técnica

O refresh token não é um JWT. Ele é opaco e tem formato:

```txt
sessionId.secret
```

O `sessionId` identifica a sessão no banco. O `secret` é a parte sensível e só existe em texto claro no cliente e durante a requisição.

No banco, a API salva apenas o hash bcrypt do `secret`. Isso reduz o risco caso o banco seja exposto.

A rotação a cada refresh reduz a janela de uso de tokens antigos. O hash anterior é preservado para diferenciar um token antigo reutilizado de um token aleatório inválido.

---

# 3. Fluxo Interno do Código

## Estrutura `UserSession`

Campos principais:

| Campo | Objetivo |
|---|---|
| `id` | ID da sessão, usado como primeira parte do refresh token |
| `userId` | Usuário dono da sessão |
| `refreshTokenHash` | Hash do segredo atual |
| `previousRefreshTokenHash` | Hash do segredo anterior |
| `previousRotatedAt` | Data da última rotação anterior |
| `expiresAt` | Expiração da sessão |
| `revokedAt` | Data de revogação |
| `userAgent` | Navegador/dispositivo usado no login |
| `ip` | IP capturado no login |
| `criadoEm` | Criação da sessão |
| `atualizadoEm` | Última atualização |

## Criação da Sessão

A criação ocorre no login.

Método principal:

```txt
criarSessaoRefreshToken(userId, metadata)
```

Responsabilidades:

- gerar `sessionId`;
- gerar `rawSecret` seguro;
- gerar hash bcrypt do secret;
- calcular expiração;
- criar registro em `UserSession`;
- salvar IP e user agent;
- limpar campos legados de refresh token em `User`.

## Formato do Refresh Token

```txt
sessionId.secret
```

Validações aplicadas:

- deve ter exatamente duas partes;
- `sessionId` deve ser UUID v4;
- `secret` deve existir;
- não pode haver terceira parte;
- `secret` não pode exceder limite defensivo.

## Rotação

Método principal:

```txt
rotacionarSessaoRefreshToken(sessionId, hashAnterior)
```

Responsabilidades:

- gerar novo segredo;
- manter o mesmo `sessionId`;
- mover o hash atual para `previousRefreshTokenHash`;
- preencher `previousRotatedAt`;
- salvar novo `refreshTokenHash`;
- renovar `expiresAt`;
- garantir `revokedAt` nulo.

## Revogação

Métodos principais:

- `revogarSessao(sessionId, userId?)`;
- `revogarTodasSessoesDoUsuario(userId)`.

A revogação preenche `revokedAt` com a data atual.

## Detecção de Reuso

No refresh:

1. compara `secret` com `refreshTokenHash`;
2. se válido, rotaciona;
3. se inválido, compara com `previousRefreshTokenHash`;
4. se bater com anterior, revoga sessão;
5. se não bater com nenhum, retorna 401 sem revogar.

---

# 4. Dicionário Técnico

## Variáveis

| Nome | Objetivo |
|---|---|
| `rawRefreshToken` | Token bruto enviado ao cliente |
| `sessionId` | Identificador da sessão |
| `rawSecret` | Segredo bruto do refresh token |
| `hashedRefreshToken` | Hash bcrypt salvo no banco |
| `refreshTokenExpiraEm` | Data de expiração |
| `previousRefreshTokenHash` | Hash anterior para detectar reuso |
| `previousRotatedAt` | Momento da rotação anterior |
| `revokedAt` | Indica sessão encerrada |

## Métodos Relacionados

| Método | Objetivo |
|---|---|
| `gerarRefreshTokenSeguro()` | Gerar token opaco e hash |
| `criarSessaoRefreshToken()` | Criar sessão no login |
| `buscarSessaoRefresh()` | Buscar sessão e usuário |
| `refreshToken()` | Validar e renovar sessão |
| `rotacionarSessaoRefreshToken()` | Rotacionar segredo |
| `compararSegredoRefresh()` | Comparar secret com hash |
| `parseRefreshToken()` | Validar formato do token |
| `revogarSessao()` | Revogar sessão atual |
| `revogarTodasSessoesDoUsuario()` | Revogar todas as sessões do usuário |

---

# 5. Serviços e Integrações

## APIs

| Endpoint | Relação com sessão |
|---|---|
| `POST /auth/login` | Cria `UserSession` |
| `POST /auth/refresh` | Valida e rotaciona sessão |
| `POST /auth/logout` | Revoga sessão atual |

## Banco de Dados

Model principal:

```txt
UserSession
```

Relação principal:

```txt
User 1:N UserSession
```

## Serviços Externos

- bcrypt para hash/comparação;
- crypto para geração de UUID e segredo aleatório;
- JWT para carregar `sid` no access token.

---

# 6. Segurança e Qualidade

## Segurança

Pontos fortes:

- refresh token opaco;
- segredo não salvo em texto claro;
- hash bcrypt no banco;
- rotação a cada uso;
- detecção de reuso real;
- revogação por sessão;
- access token vinculado à sessão por `sid`;
- validação defensiva do formato do token;
- usuário inativo/excluído perde capacidade de renovar sessão.

## Qualidade

- métodos separados por responsabilidade;
- fluxo claro de criação, busca, rotação e revogação;
- campos legados são limpos durante transição;
- schema e migrations documentam a evolução.

## Performance

- bcrypt em refresh tem custo intencional;
- busca por sessão usa ID;
- índices em `UserSession` auxiliam consultas por usuário, expiração e revogação.

---

# 7. Regras de Negócio

- cada login cria uma nova sessão;
- refresh token dura 7 dias;
- access token contém `sid`;
- refresh expirado revoga sessão;
- sessão revogada não renova token;
- usuário excluído/inativo não renova token;
- refresh válido sempre gera novo refresh token;
- token anterior reutilizado revoga sessão;
- token inválido aleatório retorna 401 sem revogar sessão;
- logout revoga a sessão atual quando `sid` existe.

---

# 8. Pontos de Atenção

- ainda existem campos legados de refresh token em `User`;
- não há rotina documentada de limpeza de sessões antigas;
- bcrypt no refresh deve ser monitorado sob carga;
- IP depende da configuração de proxy;
- revogar todas as sessões após troca de senha pode ser uma melhoria futura.

---

# 9. Relação com Outros Módulos

| Módulo | Relação |
|---|---|
| `AuthService` | Implementa criação, rotação e revogação |
| `AuthController` | Expõe login, refresh e logout |
| `AuthGuard` | Lê JWT com `sid` |
| `PrismaService` | Persiste `UserSession` |
| `User` | Dono das sessões |
| Frontend | Armazena e envia refresh token |

---

# 10. Resumo Técnico Final

A arquitetura de refresh token e sessões está em nível profissional. O uso de `UserSession`, token opaco, hash bcrypt, rotação e detecção de reuso real reduz riscos importantes de segurança.

Criticidade: muito alta.

Complexidade: alta.

Próximos cuidados: limpeza de sessões antigas, remoção de campos legados e testes e2e específicos para login, refresh, reuso e logout.
