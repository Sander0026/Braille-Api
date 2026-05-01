# 21 — Common: AuditInterceptor (`src/common/interceptors/audit.interceptor.ts`)

---

# 1. Visão Geral

## Objetivo

Documentar o `AuditInterceptor`, interceptor global responsável por registrar auditoria automática em operações de mutação da Braille API.

O interceptor atua como camada transversal de rastreabilidade. Ele observa requisições HTTP concluídas com sucesso e registra informações relevantes no módulo de auditoria.

## Responsabilidade

O `AuditInterceptor` é responsável por:

- interceptar mutações HTTP;
- mapear método e path para uma ação de auditoria;
- identificar a entidade afetada pela rota;
- capturar autor, role, IP e user agent;
- sanitizar payloads antes de persistir logs;
- respeitar o decorator `@SkipAudit()`;
- não bloquear a resposta caso a auditoria falhe.

## Fluxo de Funcionamento

```txt
Request HTTP
  ↓
AuditInterceptor
  ↓
Verifica @SkipAudit()
  ↓
Filtra método POST/PATCH/PUT/DELETE
  ↓
Mapeia ação e entidade
  ↓
Executa handler real
  ↓
No sucesso: sanitiza response/oldValue
  ↓
Chama AuditLogService.registrar()
  ↓
Resposta segue para o cliente
```

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- Interceptor Pattern;
- Cross-Cutting Concern;
- Audit Trail Pattern;
- Fire-and-forget Logging;
- Metadata-based Opt-out;
- Payload Sanitization;
- Route Heuristics Mapping.

## Justificativa Técnica

Auditoria é uma preocupação transversal. Implementá-la em um interceptor reduz repetição e garante cobertura automática de mutações.

A estratégia fire-and-forget evita que uma falha no registro de auditoria bloqueie a operação principal do usuário.

O uso de `@SkipAudit()` permite que módulos com auditoria manual mais precisa desativem apenas a auditoria automática, evitando duplicidade.

---

# 3. Fluxo Interno do Código

## `ACAO_MAP`

Mapeia método HTTP e path para `AuditAcao`.

Exemplos:

| Método/Path | Ação |
|---|---|
| `POST` genérico | `CRIAR` |
| `POST` com `/auth/login` | `LOGIN` |
| `POST` com `/auth/logout` | `LOGOUT` |
| `POST` com `/diario/fechar` | `FECHAR_DIARIO` |
| `POST` com `/diario/reabrir` | `REABRIR_DIARIO` |
| `PATCH` com `/status` | `MUDAR_STATUS` |
| `PATCH` genérico | `ATUALIZAR` |
| `DELETE` genérico | `EXCLUIR` |
| `DELETE` com `/alunos/` | `DESMATRICULAR` |

## `ENTIDADE_MAP`

Mapeia o primeiro segmento da rota para o nome canônico da entidade auditada.

Exemplos:

| Segmento | Entidade |
|---|---|
| `turmas` | `Turma` |
| `frequencias` | `Frequencia` |
| `beneficiaries` | `Aluno` |
| `auth` | `Auth` |
| `comunicados` | `Comunicado` |
| `contatos` | `Contato` |
| `modelos-certificados` | `ModeloCertificado` |
| `certificados` | `CertificadoEmitido` |
| `apoiadores` | `Apoiador` |
| `site-config` | `SiteConfig` |

## `PATHS_EXCLUIDOS`

Lista rotas técnicas ou módulos que não devem passar pela auditoria automática.

Exemplos:

- `/api-docs`;
- `/health`;
- `/audit-log`.

## `CAMPOS_SENSIVEIS`

Campos removidos do payload antes de persistir auditoria.

Exemplos:

- `senha`;
- `password`;
- `hash`;
- `passwordhash`;
- `senhahash`;
- `token`;
- `refreshtoken`;
- `secret`.

## Método `intercept()`

Responsabilidades:

1. verificar se a rota usa `@SkipAudit()`;
2. ignorar métodos que não são mutação;
3. ignorar paths técnicos;
4. resolver `AuditAcao`;
5. resolver entidade e `registroId`;
6. extrair usuário autenticado;
7. resolver IP e user agent;
8. executar o handler original;
9. no sucesso, sanitizar payload;
10. chamar `auditLogService.registrar()`.

## Sanitização de Payload

Funções relacionadas:

| Função | Objetivo |
|---|---|
| `sanitizePayload()` | Sanitizar objeto antes do log |
| `sanitizeValue()` | Delegar sanitização por tipo |
| `sanitizeString()` | Truncar strings longas |
| `sanitizeArray()` | Truncar arrays grandes |
| `isRecordWithId()` | Detectar objeto com campo `id` |

Regras:

- profundidade máxima de 2 níveis;
- strings acima de 500 caracteres são truncadas;
- arrays acima de 20 itens são substituídos por resumo;
- campos sensíveis são removidos.

---

# 4. Dicionário Técnico

## Variáveis e Constantes

| Nome | Objetivo |
|---|---|
| `ACAO_MAP` | Converter método/path em ação de auditoria |
| `ENTIDADE_MAP` | Converter path em entidade auditada |
| `PATHS_EXCLUIDOS` | Ignorar rotas técnicas |
| `CAMPOS_SENSIVEIS` | Remover dados sensíveis do log |
| `deveIgnorarAuditoria` | Resultado do metadata `@SkipAudit()` |
| `acao` | Ação final registrada |
| `entidade` | Entidade auditada |
| `registroId` | ID inferido a partir da rota ou response |
| `autorId` | ID do usuário autenticado |
| `autorNome` | Nome ou e-mail do usuário |
| `autorRole` | Role do usuário |
| `ip` | IP resolvido por helper |
| `userAgent` | Navegador/agente HTTP |
| `oldValue` | Valor anterior opcional |
| `newValue` | Valor novo sanitizado |

## Classes

| Classe | Responsabilidade |
|---|---|
| `AuditInterceptor` | Registrar auditoria automática de mutações |

## Métodos

| Método | Objetivo |
|---|---|
| `intercept()` | Interceptar mutações e registrar auditoria |
| `extrairRegistroId()` | Inferir ID do registro pela rota |

---

# 5. Serviços e Integrações

## APIs

O interceptor não expõe endpoints diretamente.

Ele atua sobre mutações HTTP de múltiplos controllers.

## Banco de Dados

O interceptor não acessa Prisma diretamente.

Ele chama:

```txt
AuditLogService.registrar()
```

O service de auditoria é responsável por persistir o log no banco.

## Integrações Internas

| Integração | Uso |
|---|---|
| `AuditLogService` | Persistir auditoria |
| `Reflector` | Ler metadata do `@SkipAudit()` |
| `AuthenticatedRequest` | Obter usuário autenticado |
| `resolverIp()` | Resolver IP real |
| `SKIP_AUDIT_KEY` | Chave de metadata |
| `AuditAcao` | Enum de ações de auditoria |

---

# 6. Segurança e Qualidade

## Segurança

Pontos fortes:

- remove campos sensíveis;
- trunca strings longas;
- trunca arrays grandes;
- limita profundidade da sanitização;
- não audita erros como ação concluída;
- usa IP e user agent para rastreabilidade;
- permite auditoria manual quando necessário.

## Qualidade

Pontos positivos:

- lógica centralizada;
- baixo acoplamento com controllers;
- mapas explícitos para ações e entidades;
- helper centralizado para IP;
- opt-out explícito por decorator.

## Performance

A auditoria roda após o handler e não deve bloquear a resposta.

A sanitização limita payloads grandes para evitar logs pesados.

---

# 7. Regras de Negócio Transversais

- somente mutações são auditadas automaticamente;
- erros HTTP não geram auditoria de sucesso;
- rotas com `@SkipAudit()` são ignoradas pela auditoria automática;
- campos sensíveis nunca devem ser persistidos em log;
- novos módulos auditáveis devem ser adicionados ao `ENTIDADE_MAP`;
- módulos com regra específica podem auditar manualmente no service.

---

# 8. Pontos de Atenção

## Riscos

- O mapeamento de entidade depende de heurística por path.
- Novas rotas podem ficar com entidade genérica se `ENTIDADE_MAP` não for atualizado.
- Fire-and-forget evita bloqueio, mas falhas de auditoria podem passar despercebidas se não houver monitoramento.
- A sanitização remove campos por nome exato normalizado; nomes sensíveis diferentes precisam ser adicionados.

## Débitos Técnicos

- Criar metadata explícita de entidade/ação por rota.
- Criar testes unitários para `sanitizePayload()`.
- Criar testes para `ACAO_MAP` e `ENTIDADE_MAP`.
- Adicionar observabilidade para falhas de auditoria.
- Padronizar auditoria manual vs automática por módulo.

## Melhorias Futuras

- Decorator `@AuditEntity()`;
- decorator `@AuditAction()`;
- correlation ID por requisição;
- logs estruturados;
- fila assíncrona para auditoria em produção de alto volume;
- painel para monitorar falhas de auditoria.

---

# 9. Relação com Outros Módulos

| Módulo | Relação |
|---|---|
| `AppModule` | Registra interceptor como `APP_INTERCEPTOR` |
| `AuditLogModule` | Fornece `AuditLogService` |
| `Common Decorators` | Usa `SkipAudit` |
| `AuthGuard` | Preenche `request.user` |
| Controllers | Podem ser auditados automaticamente |
| Services | Podem fazer auditoria manual |

---

# 10. Resumo Técnico Final

O `AuditInterceptor` é uma peça central de rastreabilidade da Braille API.

Ele registra mutações, captura autor e contexto, sanitiza payloads e evita bloqueio da resposta principal.

Criticidade: alta.

Complexidade: alta.

A implementação é profissional, mas pode evoluir para metadata explícita por rota, testes unitários de sanitização e monitoramento de falhas de auditoria.
