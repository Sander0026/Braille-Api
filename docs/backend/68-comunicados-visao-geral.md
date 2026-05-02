# 68 — Comunicados: Visão Geral do Módulo (`src/comunicados/`)

---

# 1. Visão Geral

O módulo `Comunicados` é responsável pela gestão do mural institucional de comunicados/notícias.

Ele permite que perfis autorizados criem, editem e excluam comunicados, enquanto disponibiliza rotas públicas cacheadas para listagem e leitura individual.

Arquivos principais:

```txt
src/comunicados/comunicados.module.ts
src/comunicados/comunicados.controller.ts
src/comunicados/comunicados.service.ts
src/comunicados/dto/create-comunicado.dto.ts
src/comunicados/dto/update-comunicado.dto.ts
src/comunicados/dto/query-comunicado.dto.ts
```

Responsabilidades principais:

- criar comunicados;
- editar comunicados;
- excluir comunicados;
- listar comunicados publicamente;
- consultar comunicado por ID publicamente;
- filtrar por título;
- filtrar por categoria;
- ordenar comunicados fixados no topo;
- sanitizar HTML do conteúdo;
- validar imagem de capa HTTPS;
- auditar mutações manualmente;
- remover imagem antiga do Cloudinary em background;
- aplicar cache nas rotas públicas.

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- NestJS Module Pattern;
- Controller-Service Pattern;
- Thin Controller Pattern;
- Service Layer;
- DTO Pattern;
- Public Read / Protected Write Pattern;
- Cache Pattern;
- Manual Audit Pattern;
- Best-effort File Cleanup Pattern;
- Select Projection Pattern;
- HTML Sanitization Pattern;
- Pagination Pattern.

## Justificativa Técnica

Comunicados são conteúdo institucional: precisam ser públicos para leitura, mas restritos para escrita.

Por isso, o módulo separa:

```txt
GET público e cacheado
POST/PATCH/DELETE protegido por JWT e roles
```

Essa estratégia permite exibir comunicados no portal institucional sem exigir login, mantendo o controle editorial restrito a `ADMIN` e `COMUNICACAO`.

---

# 3. ComunicadosModule

Importa:

- `AuditLogModule`;
- `UploadModule`.

Declara:

- `ComunicadosController`;
- `ComunicadosService`.

O `AuditLogModule` é usado para auditoria manual.

O `UploadModule` é usado para remover imagens antigas ou capas excluídas do Cloudinary.

---

# 4. ComunicadosController

Base route:

```txt
/comunicados
```

Decorators de classe:

```txt
@ApiTags('Comunicados (Mural)')
@SkipAudit()
@Controller('comunicados')
```

Ponto importante:

```txt
AuthGuard e RolesGuard não são globais na classe; são aplicados apenas nas rotas protegidas.
```

---

# 5. Rotas Protegidas

As rotas de escrita exigem:

```txt
AuthGuard
RolesGuard
Roles ADMIN ou COMUNICACAO
SanitizeHtmlPipe
```

| Método | Rota | Perfis | Responsabilidade |
|---|---|---|---|
| `POST` | `/comunicados` | ADMIN/COMUNICACAO | Criar comunicado |
| `PATCH` | `/comunicados/:id` | ADMIN/COMUNICACAO | Editar comunicado |
| `DELETE` | `/comunicados/:id` | ADMIN/COMUNICACAO | Excluir comunicado |

## Sanitização

Criação e atualização usam:

```txt
@UsePipes(new SanitizeHtmlPipe())
```

Isso sanitiza HTML antes de persistir o conteúdo.

---

# 6. Rotas Públicas

As rotas públicas não exigem autenticação:

| Método | Rota | Responsabilidade |
|---|---|---|
| `GET` | `/comunicados` | Listar comunicados com filtros e paginação |
| `GET` | `/comunicados/:id` | Buscar comunicado por ID |

Ambas usam:

```txt
CacheInterceptor
CacheTTL(60_000)
```

O cache reduz carga no banco em páginas públicas.

---

# 7. ComunicadosService

Métodos principais:

| Método | Responsabilidade |
|---|---|
| `create()` | Criar comunicado e auditar |
| `findAll()` | Listar comunicados com filtros, paginação e ordenação |
| `findOne()` | Buscar comunicado por ID |
| `update()` | Atualizar comunicado, limpar imagem antiga e auditar |
| `remove()` | Excluir comunicado, limpar imagem e auditar |

Helpers:

| Helper | Responsabilidade |
|---|---|
| `auditFields()` | Mapear `AuditUser` para campos do AuditLog |
| `deleteImagemAsync()` | Remover imagem do Cloudinary sem bloquear resposta |
| `omitAutor()` | Remover relação `autor` do snapshot de auditoria |

---

# 8. Select Padronizado

O service define:

```txt
COMUNICADO_SELECT
```

Campos retornados:

- `id`;
- `titulo`;
- `conteudo`;
- `categoria`;
- `fixado`;
- `imagemCapa`;
- `autorId`;
- `criadoEm`;
- `atualizadoEm`;
- `autor.nome`.

Benefícios:

- evita divergência entre `findAll()` e `findOne()`;
- reduz dados retornados;
- evita transitar campos internos desnecessários;
- facilita tipagem Prisma com `satisfies Prisma.ComunicadoSelect`.

---

# 9. Listagem Pública

Endpoint:

```txt
GET /comunicados
```

Filtros:

- `titulo`;
- `categoria`;
- `page`;
- `limit`.

Ordenação:

```txt
fixado desc
criadoEm desc
```

Isso garante que comunicados fixados apareçam primeiro.

Retorno:

```txt
data
total
page
limit
totalPages
```

---

# 10. DTOs

## CreateComunicadoDto

Campos:

| Campo | Validação | Objetivo |
|---|---|---|
| `titulo` | `IsString`, `IsNotEmpty`, `MaxLength(200)`, `trim` | Título |
| `conteudo` | `IsString`, `IsNotEmpty`, `MaxLength(50000)` | Conteúdo HTML sanitizado |
| `categoria` | `IsEnum(CategoriaComunicado)`, `IsOptional` | Categoria |
| `fixado` | `Transform`, `IsBoolean`, `IsOptional` | Fixar no topo |
| `imagemCapa` | `IsUrl(https)`, `IsOptional` | URL da capa |

## UpdateComunicadoDto

```txt
PartialType(CreateComunicadoDto)
```

## QueryComunicadoDto

Campos:

- `page`;
- `limit`;
- `titulo`;
- `categoria`.

Limite máximo:

```txt
limit <= 100
```

---

# 11. Auditoria

O controller usa:

```txt
@SkipAudit()
```

Por isso, o service registra auditoria manual em:

| Operação | Entidade | Ação |
|---|---|---|
| Criar | `Comunicado` | `CRIAR` |
| Atualizar | `Comunicado` | `ATUALIZAR` |
| Excluir | `Comunicado` | `EXCLUIR` |

A auditoria usa `void auditService.registrar(...)`, ou seja, é disparada sem aguardar.

Ponto de atenção:

```txt
No create/update/remove, a promise de auditoria é disparada sem catch explícito.
```

---

# 12. Imagem de Capa

`imagemCapa` é uma URL HTTPS opcional.

Quando a imagem é substituída no update:

```txt
imagem antiga é removida em background
```

Quando o comunicado é removido:

```txt
imagem de capa é removida em background
```

A limpeza usa:

```txt
uploadService.deleteFile(publicId)
```

Falhas geram warning e não bloqueiam a operação principal.

---

# 13. Segurança e Qualidade

## Segurança

Pontos fortes:

- escrita protegida por JWT e roles;
- leitura pública sem dados pessoais sensíveis;
- HTML passa por `SanitizeHtmlPipe`;
- imagem de capa exige HTTPS;
- IDs usam `ParseUUIDPipe`;
- select reduz exposição de dados;
- auditoria registra mutações.

## Qualidade

Pontos positivos:

- controller separa rotas públicas e protegidas;
- service coeso;
- select centralizado;
- paginação e filtros tipados;
- cleanup de imagem não bloqueante;
- ordenação por fixado e data;
- DTOs com limites claros.

## Performance

- rotas públicas cacheadas;
- listagem paginada;
- consultas e total em `Promise.all()`;
- select cirúrgico;
- limpeza de imagem assíncrona.

---

# 14. Pontos de Atenção

- Cache público pode ficar defasado após criação/edição/exclusão.
- Auditoria disparada com `void` não possui `.catch()` explícito.
- `deleteImagemAsync()` recebe `publicId`, mas pode receber URL completa conforme dado em `imagemCapa`; o UploadService suporta URL/public_id, mas o nome do parâmetro pode confundir.
- Não há filtro por status publicado/rascunho.
- Não há data de publicação/agendamento.
- Não há controle de público-alvo; leitura é pública para todos.

---

# 15. Melhorias Futuras

- Criar status `rascunho/publicado/arquivado`;
- criar data de publicação e agendamento;
- adicionar invalidação de cache após mutações;
- adicionar `.catch()` na auditoria fire-and-forget;
- criar metadados de SEO;
- criar slug público amigável;
- criar upload integrado de capa;
- criar testes de sanitização HTML;
- criar testes e2e de permissões;
- criar rate limit em rotas públicas se necessário.

---

# 16. Resumo Técnico Final

O módulo `Comunicados` implementa um mural institucional simples, seguro e eficiente.

Ele protege escrita com roles, expõe leitura pública cacheada, sanitiza HTML, audita mutações e realiza cleanup assíncrono de imagens antigas.

Criticidade: alta.

Complexidade: média.

A implementação é bem organizada. Os principais próximos passos são status de publicação, invalidação de cache, auditoria fire-and-forget com `.catch()` e testes de sanitização/permissões.
