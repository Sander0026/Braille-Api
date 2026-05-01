# 15 — Auth DTOs e Interfaces

---

# 1. Visão Geral

## Objetivo

Documentar os DTOs e interfaces usados pelo módulo Auth da Braille API.

Arquivos analisados:

```txt
src/auth/dto/login.dto.ts
src/auth/dto/refresh-token.dto.ts
src/auth/dto/trocar-senha.dto.ts
src/auth/dto/atualizar-foto.dto.ts
src/auth/dto/atualizar-perfil.dto.ts
src/common/interfaces/authenticated-request.interface.ts
```

## Responsabilidade

Os DTOs definem contratos de entrada das rotas de autenticação e perfil.

A interface `AuthenticatedRequest` padroniza o request Express após o `AuthGuard` injetar o payload do JWT em `req.user`.

Responsabilidades principais:

- validar payloads de entrada;
- limitar tamanho de campos sensíveis;
- sanitizar strings básicas;
- documentar payloads no Swagger;
- reduzir risco de payload excessivo;
- proteger contra senha longa em bcrypt;
- tipar usuário autenticado;
- evitar uso excessivo de `any` em controllers e helpers.

---

# 2. Arquitetura e Metodologias

## Padrões Arquiteturais Identificados

- DTO Pattern;
- Validation Pattern;
- Swagger Metadata Pattern;
- Request Typing Pattern;
- Defensive Input Validation;
- Security-aware Field Limits.

## Justificativa Técnica

Os DTOs ficam na borda da aplicação. Eles validam o que entra antes de chegar ao `AuthService`.

Como o `main.ts` usa `ValidationPipe` global com `whitelist`, `forbidNonWhitelisted` e `transform`, os DTOs são a primeira linha de defesa contra payloads inválidos, campos extras e entradas malformadas.

---

# 3. Fluxo Interno do Código

## LoginDto

Arquivo:

```txt
src/auth/dto/login.dto.ts
```

Campos:

| Campo | Validações | Objetivo |
|---|---|---|
| `username` | `IsString`, `IsNotEmpty`, `MaxLength(50)`, `Transform` | Nome de usuário para login |
| `senha` | `IsString`, `IsNotEmpty`, `MaxLength(72)` | Senha de acesso |

O `username` remove bytes nulos e aplica `trim()`.

O limite de 72 caracteres na senha é importante porque bcrypt trunca entradas longas. Sem esse limite, payloads grandes poderiam causar custo desnecessário e comportamento inesperado.

## RefreshTokenDto

Arquivo:

```txt
src/auth/dto/refresh-token.dto.ts
```

Campo:

| Campo | Validações | Objetivo |
|---|---|---|
| `refreshToken` | `IsString`, `IsNotEmpty`, `MaxLength(300)` | Token opaco usado para renovar sessão |

O limite evita payloads grandes e mantém o contrato coerente com o formato `sessionId.secret`.

## TrocarSenhaDto

Arquivo:

```txt
src/auth/dto/trocar-senha.dto.ts
```

Campos:

| Campo | Validações | Objetivo |
|---|---|---|
| `senhaAtual` | `IsString`, `IsNotEmpty`, `MaxLength(72)` | Confirmar senha atual |
| `novaSenha` | `IsString`, `IsNotEmpty`, `MaxLength(72)`, `IsStrongPassword` | Nova senha forte |

A nova senha exige:

- mínimo de 8 caracteres;
- ao menos uma letra minúscula;
- ao menos uma letra maiúscula;
- ao menos um número;
- ao menos um símbolo.

## AtualizarFotoDto

Arquivo:

```txt
src/auth/dto/atualizar-foto.dto.ts
```

Campo:

| Campo | Validações | Objetivo |
|---|---|---|
| `fotoPerfil` | `IsOptional`, `IsUrl`, `MaxLength(2000)` | URL pública da foto de perfil |

A validação de URL é permissiva para manter compatibilidade com URLs Cloudinary.

O campo aceita `undefined` e está tipado como opcional, podendo representar remoção quando tratado pelo service.

## AtualizarPerfilDto

Arquivo:

```txt
src/auth/dto/atualizar-perfil.dto.ts
```

Campos:

| Campo | Validações | Objetivo |
|---|---|---|
| `nome` | `IsString`, `IsOptional`, `MaxLength(150)`, `Transform` | Nome completo |
| `email` | `IsEmail`, `IsOptional`, `MaxLength(254)` | E-mail do usuário |

O `nome` remove bytes nulos e aplica `trim()`.

O limite de 254 caracteres para e-mail segue limite prático compatível com RFC 5321.

## AuthenticatedUser

Arquivo:

```txt
src/common/interfaces/authenticated-request.interface.ts
```

Campos:

| Campo | Tipo | Objetivo |
|---|---|---|
| `sub` | string | ID do usuário no JWT |
| `role` | `Role` | Perfil de autorização |
| `nome` | string opcional | Nome injetado no payload |
| `email` | string opcional | Fallback para identificação em logs |
| `sid` | string opcional | ID da sessão autenticada |

## AuthenticatedRequest

Extende `Request` do Express e adiciona:

| Campo | Tipo | Objetivo |
|---|---|---|
| `user` | `AuthenticatedUser` opcional | Payload JWT validado pelo `AuthGuard` |
| `auditOldValue` | unknown opcional | Valor anterior usado em auditoria |

---

# 4. Dicionário Técnico

## Variáveis e Campos

| Nome | Tipo | Objetivo |
|---|---|---|
| `username` | string | Login do usuário |
| `senha` | string | Senha informada no login |
| `refreshToken` | string | Token opaco de renovação |
| `senhaAtual` | string | Senha atual para troca |
| `novaSenha` | string | Nova senha forte |
| `fotoPerfil` | string opcional | URL da foto |
| `nome` | string opcional | Nome atualizado |
| `email` | string opcional | E-mail atualizado |
| `sub` | string | ID do usuário autenticado |
| `role` | Role | Perfil de autorização |
| `sid` | string opcional | ID da sessão |

## Funções e Transformações

| Função | Objetivo |
|---|---|
| `sanitizeString` em LoginDto | Remove byte nulo e aplica trim |
| `sanitizeString` em AtualizarPerfilDto | Remove byte nulo e aplica trim |

## Classes

| Classe | Responsabilidade |
|---|---|
| `LoginDto` | Validar payload de login |
| `RefreshTokenDto` | Validar refresh token |
| `TrocarSenhaDto` | Validar troca de senha |
| `AtualizarFotoDto` | Validar URL da foto |
| `AtualizarPerfilDto` | Validar atualização de perfil |

## Interfaces

| Interface | Responsabilidade |
|---|---|
| `AuthenticatedUser` | Representar payload JWT no request |
| `AuthenticatedRequest` | Representar request Express autenticado |

---

# 5. Serviços e Integrações

## APIs

| DTO/Interface | Endpoint relacionado |
|---|---|
| `LoginDto` | `POST /auth/login` |
| `RefreshTokenDto` | `POST /auth/refresh` |
| `TrocarSenhaDto` | `PATCH /auth/trocar-senha` |
| `AtualizarFotoDto` | `PATCH /auth/foto-perfil` |
| `AtualizarPerfilDto` | `PATCH /auth/perfil` |
| `AuthenticatedRequest` | Rotas protegidas por `AuthGuard` |

## Banco de Dados

DTOs não acessam banco. Eles validam contratos antes do `AuthService`, que usa `PrismaService`.

## Serviços Externos

DTOs não chamam serviços externos.

---

# 6. Segurança e Qualidade

## Segurança

Pontos fortes:

- limite de 72 caracteres em senhas por causa do bcrypt;
- senha nova exige política forte;
- refresh token tem limite de tamanho;
- URLs de foto têm limite de tamanho;
- strings removem bytes nulos;
- e-mail segue validação formal;
- request autenticado é tipado, reduzindo casts inseguros.

## Qualidade

- DTOs pequenos;
- validações declarativas;
- mensagens de erro em português;
- integração com Swagger;
- tipagem forte para request autenticado.

## Performance

Validações são leves e ocorrem antes da regra de negócio.

O limite de tamanho em senha e refresh token reduz risco de payloads excessivos.

---

# 7. Regras de Negócio

- login exige username e senha;
- username deve ter até 50 caracteres;
- senha deve ter até 72 caracteres;
- refresh token é obrigatório e tem limite de 300 caracteres;
- nova senha deve ser forte;
- foto deve ser URL válida quando enviada;
- nome pode ter até 150 caracteres;
- e-mail pode ter até 254 caracteres;
- request autenticado deve carregar `sub` e `role` quando validado pelo guard.

---

# 8. Pontos de Atenção

- `AtualizarFotoDto` usa `IsUrl` permissivo para compatibilidade; isso deve ser acompanhado pelo service e pela política de uploads.
- `AuthenticatedRequest.user` é opcional na interface, então controllers devem validar presença quando necessário.
- A validação de senha forte ocorre na troca de senha, mas login aceita a senha cadastrada existente.
- DTOs não substituem validações de negócio no service, como unicidade de e-mail.

---

# 9. Relação com Outros Módulos

| Módulo | Relação |
|---|---|
| `AuthController` | Recebe DTOs nos endpoints |
| `AuthService` | Consome dados já validados |
| `AuthGuard` | Preenche `AuthenticatedRequest.user` |
| `RolesGuard` | Usa `user.role` |
| `AuditInterceptor` | Pode usar `auditOldValue` |
| Swagger | Usa decorators `ApiProperty` e `ApiPropertyOptional` |

---

# 10. Resumo Técnico Final

Os DTOs e interfaces do Auth formam a camada de contrato do módulo de autenticação. Eles estão bem estruturados, com validações importantes para segurança, limites compatíveis com bcrypt, sanitização básica e tipagem segura de request autenticado.

Criticidade: alta.

Complexidade: média.

A implementação é profissional. Os principais cuidados futuros são manter validações alinhadas com o frontend, reforçar política de URL de foto se necessário e criar DTOs de resposta mais específicos para perfil.
