# 27 — UsersService (`src/users/users.service.ts`)

---

# 1. Visão Geral

## Objetivo

Documentar o `UsersService`, serviço responsável pelas regras de negócio da gestão de usuários internos da Braille API.

## Responsabilidade

O `UsersService` centraliza operações administrativas sobre funcionários/staff:

- criação de usuário;
- geração de username único;
- geração de matrícula staff;
- hash da senha padrão;
- sinalização de troca obrigatória de senha;
- reativação de usuário;
- validação de CPF;
- listagem paginada;
- listagem resumida;
- atualização cadastral;
- remoção de foto antiga;
- inativação;
- restauração;
- reset de senha;
- soft delete profundo;
- auditoria manual.

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- Service Layer;
- Manual Audit Pattern;
- Soft Delete Pattern;
- Credential Bootstrap Pattern;
- Defensive Admin Operations;
- Select Projection Pattern;
- Pagination Pattern;
- Environment-based Secret Configuration.

## Justificativa Técnica

A gestão de usuários é sensível porque altera acesso ao sistema. Concentrar regras no service permite controlar validações, auditoria, senha, CPF, status e exclusões de forma centralizada.

O controller usa `@SkipAudit()`, então o service registra auditoria manual para ter controle do `oldValue`, `newValue`, ação e autor.

---

# 3. Fluxo Interno do Código

## Dependências Injetadas

| Dependência | Uso |
|---|---|
| `PrismaService` | Persistência de usuários |
| `AuditLogService` | Auditoria manual |
| `UploadService` | Remoção de foto antiga |

## Senha Padrão

A função `resolverSenhaPadraoUsuario()` busca `SENHA_PADRAO_USUARIO` no ambiente.

Regras:

- se a variável existir, usa o valor configurado;
- em produção, se a variável não existir, lança erro;
- fora de produção, usa senha fallback de desenvolvimento.

Essa regra impede que produção suba sem senha padrão configurada explicitamente.

## `gerarUsername()`

Gera username a partir do nome:

```txt
primeiroNome.ultimoSobrenome
```

Remove acentos, converte para minúsculo e remove caracteres não alfanuméricos.

Se houver colisão, adiciona número incremental:

```txt
joao.silva
joao.silva2
joao.silva3
```

## `montarFiltroListagem()`

Cria filtro para listagem com:

- `statusAtivo` baseado em `inativos`;
- `excluido: false`;
- filtro por `nome`;
- filtro por `role`.

## `create()`

Fluxo:

1. recebe dados do funcionário;
2. busca usuário por CPF;
3. se CPF ativo existir, lança conflito;
4. se CPF inativo/excluído existir, retorna sinalização `_reativacao`;
5. gera username;
6. gera matrícula;
7. gera hash da senha padrão;
8. cria usuário com `precisaTrocarSenha = true`;
9. registra auditoria `CRIAR`;
10. retorna dados e `_credenciais`.

## `reativar()`

Fluxo:

1. busca usuário por ID;
2. se não existir, lança `NotFoundException`;
3. gera hash da senha padrão;
4. marca `statusAtivo = true` e `excluido = false`;
5. marca `precisaTrocarSenha = true`;
6. registra auditoria `RESTAURAR`;
7. retorna credenciais para entrega ao funcionário.

## `checkCpf()`

Normaliza CPF removendo caracteres não numéricos.

Retornos possíveis:

- `livre`;
- `ativo`;
- `inativo`;
- `excluido`.

Essa rota ajuda o frontend a decidir se deve criar novo funcionário ou sugerir reativação.

## `findAll()`

Lista usuários com paginação.

Retorna:

- `data`;
- `meta.total`;
- `meta.page`;
- `meta.lastPage`.

Não retorna senha.

## `findResumo()`

Lista dados mínimos para seleções internas.

Campos principais:

- `id`;
- `nome`;
- `username`;
- `role`;
- `fotoPerfil`.

## `update()`

Fluxo:

1. busca usuário;
2. remove foto antiga se houver troca de `fotoPerfil`;
3. valida duplicidade de CPF;
4. aplica hash caso senha seja enviada;
5. atualiza usuário;
6. registra auditoria `ATUALIZAR` sem expor senha.

## `remove()`

Inativa usuário com `statusAtivo = false`.

Proteção importante:

```txt
administrador não pode desativar a própria conta logada
```

Registra auditoria `MUDAR_STATUS`.

## `restore()`

Restaura usuário marcando `statusAtivo = true`.

Registra auditoria `RESTAURAR`.

## `resetPassword()`

Fluxo:

1. busca usuário;
2. impede reset inseguro da própria conta logada;
3. gera hash da senha padrão;
4. atualiza senha;
5. marca `precisaTrocarSenha = true`;
6. registra auditoria `ATUALIZAR`.

## `removeHard()`

Apesar do nome, executa soft delete profundo:

```txt
excluido = true
```

Protege contra exclusão da própria conta logada.

Registra auditoria `ARQUIVAR`.

---

# 4. Dicionário Técnico

## Variáveis e Constantes

| Nome | Objetivo |
|---|---|
| `SENHA_PADRAO_DESENVOLVIMENTO` | Fallback fora de produção |
| `SENHA_PADRAO` | Senha padrão resolvida no startup |
| `senhaEnv` | Valor de `SENHA_PADRAO_USUARIO` |
| `username` | Login único gerado |
| `tentativa` | Sufixo incremental em colisão |
| `matricula` | Matrícula staff gerada |
| `hashedPassword` | Senha com bcrypt |
| `whereCondicao` | Filtro Prisma para listagem |
| `auditUser` | Usuário executor da ação |
| `autorId` | ID do admin logado |

## Métodos

| Método | Objetivo |
|---|---|
| `resolverSenhaPadraoUsuario()` | Resolver senha padrão por ambiente |
| `gerarUsername()` | Criar username único |
| `montarFiltroListagem()` | Montar filtros |
| `create()` | Criar funcionário |
| `reativar()` | Reativar usuário |
| `checkCpf()` | Verificar CPF |
| `findAll()` | Listar usuários |
| `findResumo()` | Listar resumo |
| `update()` | Atualizar usuário |
| `remove()` | Inativar usuário |
| `restore()` | Restaurar usuário |
| `resetPassword()` | Resetar senha |
| `removeHard()` | Soft delete profundo |

---

# 5. Serviços e Integrações

## Banco de Dados

Model principal:

```txt
User
```

Operações Prisma usadas:

- `findUnique`;
- `findFirst`;
- `findMany`;
- `count`;
- `create`;
- `update`.

## Auditoria

Ações registradas:

| Operação | Ação |
|---|---|
| criar | `CRIAR` |
| reativar/restaurar | `RESTAURAR` |
| atualizar | `ATUALIZAR` |
| inativar | `MUDAR_STATUS` |
| soft delete profundo | `ARQUIVAR` |
| reset de senha | `ATUALIZAR` |

## Upload

`UploadService.deleteFile()` é usado para remover foto antiga ao atualizar `fotoPerfil`.

---

# 6. Segurança e Qualidade

## Segurança

Pontos fortes:

- senha com bcrypt;
- produção exige senha padrão via ambiente;
- usuário criado precisa trocar senha;
- senha removida do retorno de criação/listagem;
- CPF duplicado é bloqueado;
- não permite auto-inativação;
- não permite reset inseguro da própria conta;
- auditoria manual registra ações sensíveis;
- foto antiga é removida para evitar arquivo órfão.

## Qualidade

- tratamento de exceções por método;
- logs internos em falhas inesperadas;
- paginação em listagem;
- selects evitam expor senha;
- reativação separada de criação comum.

## Performance

- listagem usa paginação;
- `findAll` e `findResumo` usam `Promise.all` para dados e total;
- geração de username pode fazer múltiplas consultas em colisão;
- bcrypt tem custo intencional.

---

# 7. Regras de Negócio

- CPF ativo duplicado impede criação;
- CPF inativo/excluído sinaliza reativação;
- username e matrícula são automáticos;
- senha inicial é padrão;
- primeiro login deve trocar senha;
- reset de senha força troca posterior;
- inativação mantém registro;
- exclusão profunda marca `excluido = true`;
- admin não pode desativar ou excluir a própria conta logada;
- atualização de CPF exige unicidade.

---

# 8. Pontos de Atenção

- Reset de senha e reativação ainda não revogam sessões existentes.
- `_credenciais.senha` retorna senha padrão, exigindo cuidado operacional.
- `SENHA_PADRAO` é calculada no carregamento do módulo.
- `montarFiltroListagem()` usa `any`.
- `removeHard()` não remove fisicamente; o nome pode confundir manutenção futura.

---

# 9. Melhorias Futuras

- Revogar sessões após reset/reativação.
- Substituir senha padrão por convite temporário.
- Adicionar expiração de senha temporária.
- Melhorar tipagem Prisma do filtro.
- Criar testes e2e e unitários de segurança.
- Renomear `removeHard()` para refletir soft delete profundo.

---

# 10. Resumo Técnico Final

O `UsersService` é uma peça crítica da administração da API. Ele controla criação, reativação, reset, status e exclusão lógica de usuários internos.

Criticidade: muito alta.

Complexidade: alta.

A implementação está profissional e defensiva. Os principais pontos de evolução são revogação de sessões após alterações sensíveis, melhor tipagem do filtro e substituição futura da senha padrão por convite seguro.
