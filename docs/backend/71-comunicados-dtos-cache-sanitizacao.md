# 71 — Comunicados: DTOs, Cache e Sanitização

---

# 1. Visão Geral

Este documento detalha os contratos de entrada, regras de cache e sanitização do módulo `Comunicados`.

Arquivos relacionados:

```txt
src/comunicados/dto/create-comunicado.dto.ts
src/comunicados/dto/update-comunicado.dto.ts
src/comunicados/dto/query-comunicado.dto.ts
src/comunicados/comunicados.controller.ts
src/common/pipes/sanitize-html.pipe.ts
```

Responsabilidades documentadas:

- validação de criação de comunicado;
- validação de atualização parcial;
- validação de filtros públicos;
- sanitização de conteúdo HTML;
- validação de URL HTTPS para imagem de capa;
- transformação de boolean `fixado`;
- paginação pública;
- cache de rotas públicas;
- riscos de XSS persistente;
- riscos de cache defasado.

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- DTO Pattern;
- Partial Update Pattern;
- Query Filter Pattern;
- HTML Sanitization Pattern;
- Public Cache Pattern;
- URL Validation Pattern;
- Boolean Transform Pattern;
- Pagination Boundary Pattern;
- Defensive API Boundary Pattern.

## Justificativa Técnica

Comunicados são conteúdo público. Isso torna os dados de entrada sensíveis, especialmente o campo `conteudo`, que suporta HTML sanitizado.

A combinação entre DTOs, `SanitizeHtmlPipe`, validação de URL HTTPS e cache público cria uma fronteira importante contra payloads malformados, XSS persistente e excesso de consultas em páginas públicas.

---

# 3. CreateComunicadoDto

Usado em:

```txt
POST /comunicados
```

Campos:

| Campo | Validação/Transformação | Obrigatório | Objetivo |
|---|---|---:|---|
| `titulo` | `Transform(trim)`, `IsString`, `IsNotEmpty`, `MaxLength(200)` | Sim | Título do comunicado |
| `conteudo` | `IsString`, `IsNotEmpty`, `MaxLength(50000)` | Sim | Conteúdo HTML sanitizado |
| `categoria` | `IsEnum(CategoriaComunicado)`, `IsOptional` | Não | Classificação do comunicado |
| `fixado` | `Transform(boolean)`, `IsBoolean`, `IsOptional` | Não | Fixar no topo |
| `imagemCapa` | `IsUrl(https)`, `IsOptional` | Não | URL pública da imagem de capa |

---

# 4. Campo `titulo`

Regras:

- precisa ser string;
- não pode ser vazio;
- máximo de 200 caracteres;
- passa por `trim()`.

Objetivo:

```txt
Evitar títulos vazios, excessivamente grandes ou com espaços acidentais.
```

---

# 5. Campo `conteudo`

Regras no DTO:

- precisa ser string;
- não pode ser vazio;
- máximo de 50.000 caracteres.

O campo suporta HTML sanitizado.

A sanitização não acontece no DTO. Ela acontece no controller com:

```txt
@UsePipes(new SanitizeHtmlPipe())
```

Rotas afetadas:

- `POST /comunicados`;
- `PATCH /comunicados/:id`.

---

# 6. Sanitização HTML

O conteúdo do comunicado pode conter HTML controlado para formatação no portal institucional.

Risco sem sanitização:

```txt
XSS persistente
```

Exemplo de risco:

```txt
<script>alert('xss')</script>
```

Como o conteúdo é salvo no banco e depois exibido em rota pública, a sanitização antes da persistência é essencial.

## Pontos importantes

- o `SanitizeHtmlPipe` é aplicado no controller;
- a sanitização protege criação e edição;
- o frontend também deve renderizar conteúdo de forma segura;
- mudanças no pipe impactam diretamente a segurança do portal.

---

# 7. Campo `categoria`

Validação:

```txt
IsEnum(CategoriaComunicado)
```

Uso:

- classificar comunicados;
- permitir filtro público por categoria;
- organizar mural institucional.

Ponto de atenção:

```txt
Categorias dependem do enum Prisma `CategoriaComunicado`.
```

---

# 8. Campo `fixado`

O DTO permite receber boolean real ou string booleana.

Transformação:

```txt
'true'  → true
true    → true
'false' → false
false   → false
outros  → mantém valor original
```

Depois valida com:

```txt
IsBoolean()
```

Objetivo:

```txt
Suportar envio via JSON e também formatos vindos de formulários.
```

Impacto na listagem:

```txt
fixado desc
criadoEm desc
```

Comunicados fixados aparecem primeiro.

---

# 9. Campo `imagemCapa`

Validação:

```txt
IsUrl({ require_protocol: true, protocols: ['https'] })
```

Regras:

- é opcional;
- precisa ser URL válida;
- exige protocolo;
- aceita somente HTTPS.

Objetivo:

- impedir URLs malformadas;
- reduzir risco de conteúdo misto no navegador;
- reforçar uso de assets seguros.

Ponto de atenção:

```txt
O DTO não restringe domínio, apenas exige HTTPS.
```

Se a política exigir apenas Cloudinary, pode ser criado validator customizado para `res.cloudinary.com`.

---

# 10. UpdateComunicadoDto

Implementação:

```txt
UpdateComunicadoDto extends PartialType(CreateComunicadoDto)
```

Uso:

```txt
PATCH /comunicados/:id
```

Isso torna todos os campos opcionais.

Benefícios:

- permite atualização parcial;
- evita duplicação de validações;
- mantém regras alinhadas à criação;
- reaproveita transformações de `titulo` e `fixado`.

Ponto de atenção:

```txt
Como todos os campos são opcionais, payload vazio pode chegar ao service se não houver validação adicional.
```

---

# 11. QueryComunicadoDto

Usado em:

```txt
GET /comunicados
```

Campos:

| Campo | Validação/Transformação | Padrão | Objetivo |
|---|---|---|---|
| `page` | `Type(Number)`, `IsInt`, `Min(1)`, `IsOptional` | `1` | Página atual |
| `limit` | `Type(Number)`, `IsInt`, `Min(1)`, `Max(100)`, `IsOptional` | `10` | Itens por página |
| `titulo` | `IsString`, `MaxLength(200)`, `IsOptional` | — | Busca parcial por título |
| `categoria` | `IsEnum(CategoriaComunicado)`, `IsOptional` | — | Filtro por categoria |

---

# 12. Paginação

Regras:

- `page` mínimo 1;
- `limit` mínimo 1;
- `limit` máximo 100.

O service calcula:

```txt
skip = (page - 1) * limit
```

Retorno:

```txt
data
total
page
limit
totalPages
```

Benefícios:

- evita retorno massivo;
- melhora performance pública;
- protege o banco de consultas muito grandes.

---

# 13. Busca por Título

Filtro:

```txt
titulo contains titulo mode insensitive
```

Comportamento:

- busca parcial;
- ignora diferença entre maiúsculas/minúsculas;
- máximo de 200 caracteres pelo DTO.

---

# 14. Cache Público

Rotas cacheadas:

```txt
GET /comunicados
GET /comunicados/:id
```

Configuração:

```txt
@UseInterceptors(CacheInterceptor)
@CacheTTL(60_000)
```

Objetivo:

- reduzir leituras repetidas;
- acelerar portal público;
- aliviar banco em acessos anônimos.

## Chave de cache

A listagem usa a URL completa como chave.

Isso preserva:

- página;
- limite;
- filtro de título;
- categoria.

Exemplos conceituais:

```txt
/comunicados?page=1&limit=10
/comunicados?page=2&limit=10
/comunicados?categoria=EVENTO
```

---

# 15. Risco de Cache Defasado

Como não há invalidação explícita de cache após mutações, pode ocorrer:

- comunicado criado não aparecer imediatamente;
- comunicado editado continuar com conteúdo antigo;
- comunicado excluído continuar visível até expirar o TTL;
- imagem substituída continuar referenciada no cache.

Esse risco é aceitável em TTL curto, mas precisa ser conhecido.

---

# 16. Relação com Upload/Cloudinary

`imagemCapa` é apenas uma URL no DTO.

O upload de arquivo ocorre separadamente no módulo `Upload`.

O service de comunicados remove imagens antigas com:

```txt
uploadService.deleteFile(imagemCapa)
```

Essa limpeza é assíncrona e best-effort.

---

# 17. Segurança e Qualidade

## Segurança

Pontos fortes:

- HTML passa por pipe de sanitização;
- título tem limite de tamanho;
- conteúdo tem limite de tamanho;
- imagem exige HTTPS;
- categoria é validada por enum;
- paginação limita `limit` a 100;
- campos extras são bloqueados pelo `ValidationPipe` global.

## Qualidade

Pontos positivos:

- DTOs pequenos;
- update reaproveita criação;
- query possui limites claros;
- cache público reduz carga;
- boolean string é convertido corretamente;
- Swagger documenta os campos.

---

# 18. Pontos de Atenção

- `imagemCapa` não restringe domínio ao Cloudinary.
- `conteudo` pode ser grande: até 50.000 caracteres.
- DTO não valida se `conteudo` HTML final ficou vazio após sanitização.
- Cache não é invalidado em mutações.
- Payload vazio em PATCH pode ser aceito.
- Não há DTO de params para ID; controller usa `ParseUUIDPipe` diretamente.

---

# 19. Melhorias Futuras

- Criar validator de domínio para `imagemCapa`, se a política exigir Cloudinary;
- validar conteúdo depois da sanitização para evitar HTML vazio;
- adicionar `MinLength` para título e conteúdo;
- impedir PATCH vazio;
- invalidar cache após create/update/delete;
- criar status `rascunho/publicado/arquivado`;
- criar slug público;
- criar testes de XSS com `SanitizeHtmlPipe`;
- criar testes de cache por URL/filtro;
- criar rate limit nas rotas públicas.

---

# 20. Resumo Técnico Final

Os DTOs, cache e sanitização do módulo `Comunicados` formam a principal fronteira de segurança do mural público.

A implementação valida campos, limita payloads, sanitiza HTML e usa cache para leitura pública.

Criticidade: alta.

Complexidade: média.

As principais melhorias são restringir domínio da imagem de capa, validar conteúdo pós-sanitização, impedir PATCH vazio e invalidar cache após mutações.
