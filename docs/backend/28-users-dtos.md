# 28 — Users DTOs (`src/users/dto/`)

---

# 1. Visão Geral

## Objetivo

Documentar os DTOs do módulo `Users`, responsáveis por definir e validar os contratos de entrada das rotas administrativas de usuários internos.

Arquivos documentados:

```txt
src/users/dto/create-user.dto.ts
src/users/dto/update-user.dto.ts
src/users/dto/query-user.dto.ts
```

## Responsabilidade

Os DTOs do módulo `Users` são responsáveis por:

- validar dados de criação de funcionário;
- validar dados opcionais de atualização;
- validar filtros de listagem;
- limitar paginação;
- validar `role` com enum Prisma;
- documentar payloads no Swagger;
- impedir campos extras em conjunto com o `ValidationPipe` global;
- apoiar a segurança do CRUD administrativo.

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- DTO Pattern;
- Validation Pattern;
- Swagger Metadata Pattern;
- Partial Update Pattern;
- Query Pagination Pattern;
- Enum Validation Pattern.

## Justificativa Técnica

O módulo `Users` é restrito ao `ADMIN`, mas ainda assim precisa de validação robusta.

Os DTOs atuam na borda da aplicação, antes da regra de negócio no `UsersService`. Isso reduz payloads inválidos e padroniza contratos para o frontend.

O `ValidationPipe` global com `whitelist`, `forbidNonWhitelisted` e `transform` torna os DTOs ainda mais importantes, pois campos não declarados são rejeitados.

---

# 3. Fluxo Interno do Código

## `CreateUserDto`

Arquivo:

```txt
src/users/dto/create-user.dto.ts
```

Responsável por validar criação de funcionário/staff.

Campos principais:

| Campo | Validações | Obrigatório | Objetivo |
|---|---|---:|---|
| `nome` | `IsString`, `IsNotEmpty` | Sim | Nome completo do funcionário |
| `cpf` | `IsString`, `IsNotEmpty` | Sim | CPF único do funcionário |
| `role` | `IsEnum(Role)`, `IsOptional` | Não | Perfil de acesso |
| `email` | `IsEmail`, `IsOptional` | Não | E-mail do funcionário |
| `telefone` | `IsString`, `IsOptional` | Não | Contato |
| `cep` | `IsString`, `IsOptional` | Não | CEP |
| `rua` | `IsString`, `IsOptional` | Não | Rua |
| `numero` | `IsString`, `IsOptional` | Não | Número |
| `complemento` | `IsString`, `IsOptional` | Não | Complemento |
| `bairro` | `IsString`, `IsOptional` | Não | Bairro |
| `cidade` | `IsString`, `IsOptional` | Não | Cidade |
| `uf` | `IsString`, `IsOptional` | Não | Estado/UF |

Regra importante:

```txt
O ADMIN não informa username, senha nem matrícula.
```

Esses campos são gerados pelo backend.

## `UpdateUserDto`

Arquivo:

```txt
src/users/dto/update-user.dto.ts
```

Extende:

```txt
PartialType(CreateUserDto)
```

Isso significa que todos os campos de `CreateUserDto` podem ser usados na atualização, mas passam a ser opcionais.

Campos adicionais:

| Campo | Validações | Objetivo |
|---|---|---|
| `senha` | `IsString`, `IsOptional`, `IsStrongPassword` | Nova senha forte |
| `fotoPerfil` | `IsString`, `IsOptional` | URL da foto de perfil |

Política de senha forte:

- mínimo de 8 caracteres;
- pelo menos 1 letra minúscula;
- pelo menos 1 letra maiúscula;
- pelo menos 1 número;
- pelo menos 1 símbolo.

## `QueryUserDto`

Arquivo:

```txt
src/users/dto/query-user.dto.ts
```

Responsável por filtros e paginação.

Campos:

| Campo | Validações/Transformações | Padrão | Objetivo |
|---|---|---|---|
| `page` | `Type(Number)`, `IsInt`, `Min(1)` | `1` | Página atual |
| `limit` | `Type(Number)`, `IsInt`, `Min(1)`, `Max(100)` | `10` | Tamanho da página |
| `nome` | `IsString`, `IsOptional` | — | Filtro por nome |
| `inativos` | `Transform`, `IsOptional` | `false` | Listar usuários inativos |
| `role` | `IsEnum(Role)`, `IsOptional` | — | Filtrar por perfil |

A transformação de `inativos` converte:

```txt
'true' ou true → true
outros valores → false
```

---

# 4. Dicionário Técnico

## Campos

| Campo | Tipo | Origem | Impacto |
|---|---|---|---|
| `nome` | string | Create/Update | Base para cadastro e geração de username |
| `cpf` | string | Create/Update | Identificador único operacional |
| `role` | Role | Create/Update/Query | Define perfil de acesso |
| `email` | string | Create/Update | Contato e identificação |
| `senha` | string | Update | Pode alterar senha com política forte |
| `fotoPerfil` | string | Update | URL de imagem de perfil |
| `page` | number | Query | Paginação |
| `limit` | number | Query | Limite máximo 100 |
| `inativos` | boolean | Query | Alterna filtro de status |

## Classes

| Classe | Responsabilidade |
|---|---|
| `CreateUserDto` | Validar criação de funcionário |
| `UpdateUserDto` | Validar atualização parcial |
| `QueryUserDto` | Validar filtros de listagem |

## Dependências Externas

| Dependência | Uso |
|---|---|
| `class-validator` | Validações declarativas |
| `class-transformer` | Transformação de query params |
| `@nestjs/swagger` | Documentação OpenAPI |
| `@prisma/client` | Enum `Role` |
| `PartialType` | DTO de atualização parcial |

---

# 5. Serviços e Integrações

## APIs que usam os DTOs

| DTO | Endpoint |
|---|---|
| `CreateUserDto` | `POST /users` |
| `UpdateUserDto` | `PATCH /users/:id` |
| `QueryUserDto` | `GET /users` |
| `QueryUserDto` | `GET /users/resumo` |

## Banco de Dados

DTOs não acessam banco diretamente.

Eles são consumidos pelo `UsersService`, que persiste os dados no model `User`.

## Swagger

Os decorators `ApiProperty` e `ApiPropertyOptional` documentam os campos nos contratos OpenAPI.

---

# 6. Segurança e Qualidade

## Segurança

Pontos fortes:

- `role` validada por enum;
- e-mail validado formalmente;
- senha de atualização exige política forte;
- paginação tem limite máximo de 100;
- campos extras são rejeitados pelo `ValidationPipe` global;
- username, matrícula e senha inicial não são informados pelo cliente.

## Qualidade

- DTOs simples e claros;
- uso de `PartialType` evita duplicação;
- filtros de listagem tipados;
- documentação Swagger integrada;
- paginação com defaults.

## Performance

- limite de paginação evita consultas muito grandes;
- transformação numérica evita parsing manual no service;
- DTOs reduzem validação manual repetida.

---

# 7. Regras de Negócio Representadas

- criação exige `nome` e `cpf`;
- role, e-mail, telefone e endereço são opcionais;
- atualização é parcial;
- senha atualizada precisa ser forte;
- listagem começa na página 1;
- limite de listagem não pode passar de 100;
- `inativos` é convertido de string para boolean;
- `role` só aceita valores existentes no enum Prisma.

---

# 8. Pontos de Atenção

## Riscos

- `cpf` é apenas string no DTO; a normalização/validação mais profunda ocorre no service.
- `fotoPerfil` é string simples, não `IsUrl`; pode ser reforçado se o contrato exigir URL válida.
- Campos de endereço não têm limite de tamanho no DTO.
- `UpdateUserDto` permite campo `senha`, mas o fluxo recomendado para reset administrativo é endpoint específico.

## Débitos Técnicos

- Adicionar `MaxLength` em campos textuais.
- Adicionar validação específica de CPF, se desejado.
- Avaliar `IsUrl` para `fotoPerfil`.
- Avaliar se atualização direta de `senha` deve continuar no `UpdateUserDto`.
- Sanitizar/normalizar `nome` e campos textuais com `Transform`.

## Melhorias Futuras

- Criar `Cpf` custom validator.
- Criar DTO separado para alteração de senha administrativa.
- Criar DTO separado para foto de perfil.
- Limitar `uf` a 2 caracteres.
- Normalizar CPF no DTO ou pipe dedicado.

---

# 9. Relação com Outros Módulos

| Módulo | Relação |
|---|---|
| `UsersController` | Recebe DTOs nas rotas |
| `UsersService` | Consome dados validados |
| `ValidationPipe` | Executa validações globalmente |
| `Auth/RBAC` | Garante que só ADMIN use esses DTOs |
| Swagger | Documenta payloads |
| Prisma | Usa enum `Role` |

---

# 10. Resumo Técnico Final

Os DTOs do módulo `Users` estruturam os contratos administrativos de usuários internos.

A implementação está funcional e alinhada ao NestJS, com validações básicas, enum `Role`, senha forte e paginação limitada.

Criticidade: alta.

Complexidade: média.

Recomendações principais: adicionar limites de tamanho, validação específica de CPF, `IsUrl` em `fotoPerfil` e avaliar separação de DTOs para senha/foto.
