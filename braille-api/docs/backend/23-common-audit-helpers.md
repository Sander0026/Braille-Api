# 23 — Common: Helpers e Interfaces de Auditoria

---

# 1. Visão Geral

## Objetivo

Documentar os helpers e interfaces compartilhados para auditoria da Braille API.

Arquivos documentados:

```txt
src/common/helpers/audit.helper.ts
src/common/interfaces/audit-user.interface.ts
src/common/interfaces/authenticated-request.interface.ts
```

Esses recursos padronizam como controllers e services extraem dados do usuário autenticado e metadados da requisição para registrar auditoria.

## Responsabilidade

Os helpers e interfaces de auditoria são responsáveis por:

- centralizar extração do usuário autenticado;
- padronizar `autorId`, `autorNome`, `autorRole`, IP e user agent;
- resolver IP real com suporte a proxy reverso;
- evitar duplicação de lógica em controllers;
- reduzir uso de `any`;
- padronizar dados usados pelo `AuditLogService`;
- manter compatibilidade com auditoria automática e manual.

## Fluxo de Funcionamento

```txt
Controller protegido recebe request
  ↓
AuthGuard preenche req.user
  ↓
Controller chama getAuditUser(req)
  ↓
Helper extrai sub, nome, role, IP e user agent
  ↓
Service recebe AuditUser
  ↓
Service registra auditoria ou converte com toAuditMetadata()
```

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- Helper Centralization Pattern;
- Request Enrichment Pattern;
- Audit Metadata Pattern;
- Type-safe Authenticated Request;
- Least Privilege Fallback;
- Reverse Proxy IP Resolution.

## Justificativa Técnica

Antes da centralização, cada controller poderia extrair usuário, IP e user agent de maneira diferente. Isso geraria inconsistência nos logs de auditoria.

Com `getAuditUser(req)`, a aplicação passa a ter uma fonte única para dados do autor da ação.

Benefícios:

- menor duplicação;
- menos erro humano;
- auditoria mais consistente;
- melhor tipagem;
- suporte padronizado a proxy;
- simplificação dos controllers.

---

# 3. Fluxo Interno do Código

## Interface `AuditUser`

Arquivo:

```txt
src/common/interfaces/audit-user.interface.ts
```

Representa os dados mínimos do usuário autenticado necessários para auditoria.

Campos:

| Campo | Tipo | Objetivo |
|---|---|---|
| `sub` | string | UUID do usuário autenticado |
| `nome` | string | Nome exibido no snapshot de auditoria |
| `role` | `Role` | Perfil do usuário tipado pelo enum Prisma |
| `ip` | string opcional | IP real do cliente |
| `userAgent` | string opcional | Navegador/agente HTTP |

## Interface `AuditMetadata`

Declarada em `audit.helper.ts`.

Campos:

| Campo | Objetivo |
|---|---|
| `autorId` | ID do usuário que realizou a ação |
| `autorNome` | Nome do usuário |
| `autorRole` | Perfil do usuário |
| `ip` | IP do cliente |
| `userAgent` | Agente HTTP |

Essa interface é útil para converter `AuditUser` em formato persistível pelo serviço de auditoria.

## Função `getAuditUser()`

Responsabilidade:

- receber `AuthenticatedRequest`;
- acessar `req.user`;
- extrair `sub`, `nome`, `email`, `role`;
- resolver IP com `resolverIp(req)`;
- extrair `user-agent`;
- retornar `AuditUser`.

Fallbacks:

- `nome`: usa `user.nome`, depois `user.email`, depois `'Desconhecido'`;
- `role`: usa `user.role`, com fallback `Role.SECRETARIA`.

O fallback para `SECRETARIA` é conservador porque representa menor privilégio do que `ADMIN`.

## Função `toAuditMetadata()`

Converte `AuditUser` para `AuditMetadata`.

Mapeamento:

| `AuditUser` | `AuditMetadata` |
|---|---|
| `sub` | `autorId` |
| `nome` | `autorNome` |
| `role` | `autorRole` |
| `ip` | `ip` |
| `userAgent` | `userAgent` |

## Função `resolverIp()`

Responsável por resolver o IP real do cliente.

Ordem de prioridade:

1. header `x-forwarded-for`;
2. header `x-real-ip`;
3. `req.socket.remoteAddress`.

Quando `x-forwarded-for` contém múltiplos IPs, usa o primeiro da cadeia, que normalmente representa o IP original do cliente.

---

# 4. Dicionário Técnico

## Variáveis e Campos

| Nome | Tipo | Objetivo |
|---|---|---|
| `req.user` | `AuthenticatedUser` | Payload JWT preenchido pelo `AuthGuard` |
| `sub` | string | ID do usuário autenticado |
| `nome` | string | Nome do usuário para auditoria |
| `email` | string opcional | Fallback para nome do autor |
| `role` | `Role` | Perfil do usuário |
| `ip` | string opcional | IP real resolvido |
| `userAgent` | string opcional | Header user-agent |
| `forwarded` | string/string[] | Header `x-forwarded-for` |
| `realIp` | string/string[] | Header `x-real-ip` |

## Funções

| Função | Parâmetros | Retorno | Objetivo |
|---|---|---|---|
| `getAuditUser()` | `AuthenticatedRequest` | `AuditUser` | Extrair autor completo da requisição |
| `toAuditMetadata()` | `AuditUser` | `AuditMetadata` | Converter para metadados de persistência |
| `resolverIp()` | `AuthenticatedRequest` | `string | undefined` | Resolver IP real do cliente |

## Interfaces

| Interface | Responsabilidade |
|---|---|
| `AuditUser` | Padronizar dados do autor de auditoria |
| `AuditMetadata` | Padronizar metadados persistíveis |
| `AuthenticatedRequest` | Tipar request autenticado usado pelos helpers |

---

# 5. Serviços e Integrações

## APIs

Os helpers não expõem endpoints.

São usados por controllers e services que precisam registrar auditoria manual.

Exemplos de uso:

```txt
getAuditUser(req)
```

em controllers como:

- Users;
- Beneficiaries;
- Turmas;
- Frequências;
- Comunicados;
- Certificados;
- Upload;
- Apoiadores.

## Banco de Dados

Os helpers não acessam banco diretamente.

Eles fornecem dados para services que registram `AuditLog`.

## Serviços Externos

Não há integração externa direta.

A função `resolverIp()` depende de headers HTTP populados por proxies/reverse proxies.

---

# 6. Segurança e Qualidade

## Segurança

Pontos fortes:

- centraliza extração do IP real;
- evita duplicidade de lógica insegura;
- role é tipada com enum Prisma;
- fallback de role evita assumir `ADMIN` em caso de ausência;
- user agent é preservado para rastreabilidade;
- IP considera `x-forwarded-for` e `x-real-ip`.

## Qualidade

Pontos positivos:

- interfaces claras;
- helper reutilizável;
- elimina duplicação em controllers;
- melhora consistência dos logs;
- facilita manutenção de auditoria.

## Performance

Impacto irrelevante. As funções apenas leem propriedades do request e headers.

---

# 7. Regras de Negócio Transversais

- toda auditoria manual deve usar `getAuditUser(req)`;
- o autor deve carregar ID, nome, role, IP e user agent;
- o IP real deve priorizar headers de proxy;
- o fallback de role não deve conceder privilégio alto;
- services não devem recriar lógica própria de extração de auditoria.

---

# 8. Pontos de Atenção

## Riscos

- Headers `x-forwarded-for` podem ser manipulados se a aplicação não estiver corretamente configurada atrás de proxy confiável.
- O fallback `Role.SECRETARIA` é seguro em termos de privilégio, mas pode mascarar ausência inesperada de `req.user.role`.
- Se o ambiente de deploy usar múltiplos proxies, a política de IP real precisa ser validada.

## Débitos Técnicos

- Configurar explicitamente trust proxy no ambiente, se necessário.
- Criar testes unitários para `resolverIp()` com múltiplos headers.
- Avaliar log/alerta quando `req.user` estiver ausente em rota que deveria ser autenticada.
- Documentar política de IP real do deploy.

## Melhorias Futuras

- Criar um decorator `@AuditUser()` para injetar o usuário de auditoria diretamente no controller.
- Adicionar correlation ID por requisição.
- Integrar com logging estruturado.
- Validar IP com lista de proxies confiáveis.

---

# 9. Relação com Outros Módulos

| Módulo | Relação |
|---|---|
| `AuthGuard` | Preenche `req.user` consumido pelo helper |
| `AuditInterceptor` | Reutiliza `resolverIp()` |
| `AuditLogService` | Recebe metadados extraídos |
| Controllers | Chamam `getAuditUser(req)` |
| Services | Recebem `AuditUser` para registrar ações |
| `AuthenticatedRequest` | Tipo base usado pelo helper |

---

# 10. Resumo Técnico Final

Os helpers e interfaces de auditoria padronizam a identificação do autor das ações na Braille API.

Eles reduzem duplicação, melhoram consistência dos logs e centralizam regras de IP, user agent e role.

Criticidade: alta.

Complexidade: baixa/média.

A implementação está profissional. Os principais pontos futuros são testar resolução de IP, validar trust proxy e considerar um decorator específico para injetar `AuditUser` nos controllers.
