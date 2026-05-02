# 69 — ComunicadosController (`src/comunicados/comunicados.controller.ts`)

---

# 1. Visão Geral

O `ComunicadosController` é a camada HTTP do módulo de comunicados/mural institucional.

Ele separa claramente:

- rotas protegidas de escrita;
- rotas públicas de leitura;
- validação de UUID via pipe;
- sanitização HTML em criação/edição;
- cache em listagem e detalhe;
- extração do usuário de auditoria;
- delegação das regras de negócio ao `ComunicadosService`.

Arquivo documentado:

```txt
src/comunicados/comunicados.controller.ts
```

---

# 2. Decorators de Classe

```txt
@ApiTags('Comunicados (Mural)')
@SkipAudit()
@Controller('comunicados')
```

Impacto:

- agrupa as rotas no Swagger como `Comunicados (Mural)`;
- define a rota base `/comunicados`;
- desativa a auditoria automática na classe inteira.

Ponto importante:

```txt
AuthGuard e RolesGuard não são aplicados na classe inteira.
```

Eles são aplicados apenas nas rotas protegidas de criação, edição e exclusão.

---

# 3. Estratégia de Rotas

O controller usa a estratégia:

```txt
Escrita protegida
Leitura pública
```

Isso permite que comunicados sejam exibidos publicamente no portal institucional, enquanto o controle editorial fica restrito a perfis autorizados.

---

# 4. Rotas Protegidas

As rotas protegidas usam:

```txt
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.COMUNICACAO)
```

Perfis:

- `ADMIN`;
- `COMUNICACAO`.

Rotas:

| Método | Rota | Responsabilidade |
|---|---|---|
| `POST` | `/comunicados` | Criar comunicado |
| `PATCH` | `/comunicados/:id` | Editar comunicado |
| `DELETE` | `/comunicados/:id` | Excluir comunicado |

---

# 5. `POST /comunicados`

Objetivo:

```txt
Criar um novo comunicado institucional.
```

Decorators:

```txt
@Post()
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.COMUNICACAO)
@UsePipes(new SanitizeHtmlPipe())
@ApiOperation({ summary: 'Criar um novo comunicado' })
```

Fluxo:

1. valida autenticação;
2. valida role `ADMIN` ou `COMUNICACAO`;
3. aplica `SanitizeHtmlPipe` no payload;
4. extrai `AuditUser` via `getAuditUser(req)`;
5. chama `comunicadosService.create(dto, auditUser)`.

---

# 6. `PATCH /comunicados/:id`

Entrada:

```txt
Param: id com ParseUUIDPipe
Body: UpdateComunicadoDto
Request: AuthenticatedRequest
```

Fluxo:

1. valida autenticação;
2. valida role;
3. valida `id` como UUID;
4. sanitiza HTML do body;
5. extrai usuário de auditoria;
6. chama `comunicadosService.update(id, dto, auditUser)`.

---

# 7. `DELETE /comunicados/:id`

Entrada:

```txt
Param: id com ParseUUIDPipe
Request: AuthenticatedRequest
```

Fluxo:

1. valida autenticação;
2. valida role;
3. valida `id` como UUID;
4. extrai usuário de auditoria;
5. chama `comunicadosService.remove(id, auditUser)`.

---

# 8. Rotas Públicas

As rotas públicas não usam `AuthGuard`.

| Método | Rota | Responsabilidade |
|---|---|---|
| `GET` | `/comunicados` | Listar comunicados |
| `GET` | `/comunicados/:id` | Buscar comunicado por ID |

Essas rotas são próprias para o portal institucional.

---

# 9. `GET /comunicados`

Decorators:

```txt
@Get()
@UseInterceptors(CacheInterceptor)
@CacheTTL(60_000)
@ApiOperation({ summary: 'Listar todos os comunicados (Rota Pública)' })
```

Entrada:

```txt
Query: QueryComunicadoDto
```

Filtros aceitos:

- `page`;
- `limit`;
- `titulo`;
- `categoria`.

---

# 10. `GET /comunicados/:id`

Decorators:

```txt
@Get(':id')
@UseInterceptors(CacheInterceptor)
@CacheTTL(60_000)
@ApiOperation({ summary: 'Obter um comunicado específico pelo ID (Rota Pública)' })
```

Entrada:

```txt
Param: id com ParseUUIDPipe
```

---

# 11. Cache

As rotas públicas usam:

```txt
CacheInterceptor
CacheTTL(60_000)
```

Objetivo:

- reduzir carga no banco;
- acelerar páginas públicas;
- preservar filtros e paginação pela URL completa.

---

# 12. Sanitização HTML

Criação e atualização usam:

```txt
@UsePipes(new SanitizeHtmlPipe())
```

Como comunicados são públicos, sanitizar o conteúdo antes de salvar é essencial para reduzir risco de XSS persistente.

---

# 13. Validação de UUID

Rotas por ID usam:

```txt
@Param('id', new ParseUUIDPipe())
```

Rotas afetadas:

- `PATCH /comunicados/:id`;
- `DELETE /comunicados/:id`;
- `GET /comunicados/:id`.

---

# 14. Auditoria

O controller usa:

```txt
@SkipAudit()
```

Por isso, rotas mutáveis enviam o usuário de auditoria ao service:

```txt
getAuditUser(req)
```

Operações auditáveis:

- criar comunicado;
- editar comunicado;
- excluir comunicado.

---

# 15. Segurança e Qualidade

## Segurança

- escrita exige JWT;
- escrita exige role editorial;
- HTML é sanitizado em criação/edição;
- IDs são validados como UUID;
- leitura pública não expõe dados sensíveis;
- auditoria manual recebe usuário autenticado.

## Qualidade

- separação clara entre leitura pública e escrita protegida;
- controller fino;
- cache em rotas públicas;
- Swagger documenta operações;
- uso consistente de DTOs;
- service concentra regra de negócio.

---

# 16. Pontos de Atenção

- Rotas públicas não possuem rate limit específico.
- Cache pode ficar defasado após criação, edição ou exclusão.
- `@SkipAudit()` exige cuidado para que novas mutações sejam auditadas manualmente.
- Não há endpoints específicos para publicar, arquivar ou despublicar.
- `SanitizeHtmlPipe` é aplicado no body inteiro; mudanças no DTO precisam considerar isso.

---

# 17. Melhorias Futuras

- Adicionar rate limit nas rotas públicas;
- invalidar cache após mutações;
- criar endpoints de publicação/arquivamento;
- adicionar rota por slug público;
- auditar leituras administrativas, se forem adicionadas;
- criar DTO de params para ID;
- documentar schemas de resposta no Swagger;
- criar testes e2e para público/protegido.

---

# 18. Resumo Técnico Final

O `ComunicadosController` implementa corretamente a separação entre mural público e gestão editorial protegida.

Ele usa roles, sanitização HTML, cache, validação UUID e auditoria manual via service.

Criticidade: alta.

Complexidade: média.
