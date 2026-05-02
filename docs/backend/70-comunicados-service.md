# 70 — ComunicadosService (`src/comunicados/comunicados.service.ts`)

---

# 1. Visão Geral

O `ComunicadosService` concentra as regras de negócio do mural institucional.

Ele executa CRUD de comunicados, consultas públicas com filtros e paginação, auditoria manual e limpeza assíncrona de imagens no Cloudinary.

Arquivo documentado:

```txt
src/comunicados/comunicados.service.ts
```

Responsabilidades principais:

- criar comunicado;
- listar comunicados com filtros;
- buscar comunicado por ID;
- atualizar comunicado;
- remover comunicado;
- auditar criação, atualização e exclusão;
- limpar imagem antiga ao substituir capa;
- limpar imagem de capa ao excluir comunicado;
- padronizar campos retornados com `COMUNICADO_SELECT`;
- evitar vazamento de relações internas na auditoria.

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- Service Layer;
- CRUD Service Pattern;
- Select Projection Pattern;
- Pagination Pattern;
- Public Query Pattern;
- Manual Audit Pattern;
- Fire-and-forget Pattern;
- Best-effort File Cleanup;
- Guard Clause Pattern;
- DRY Helper Pattern;
- Typed Prisma Query Pattern.

## Justificativa Técnica

O service mantém a lógica de persistência e efeitos colaterais fora do controller.

A leitura pública é otimizada com select específico e paginação, enquanto as mutações são auditadas e disparam limpeza de imagens antigas sem bloquear a resposta HTTP.

---

# 3. Dependências

| Dependência | Uso |
|---|---|
| `PrismaService` | Persistência e consultas de comunicados |
| `AuditLogService` | Auditoria manual das mutações |
| `UploadService` | Exclusão de imagens antigas no Cloudinary |
| `Logger` | Registro de falhas não bloqueantes |

Enums/tipos usados:

- `Prisma`;
- `AuditAcao`;
- `AuditUser`.

---

# 4. COMUNICADO_SELECT

O service centraliza os campos retornados em:

```txt
COMUNICADO_SELECT
```

Campos selecionados:

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

## Benefícios

- mantém `findAll()` e `findOne()` consistentes;
- evita retorno de campos internos desnecessários;
- reduz payload;
- melhora segurança;
- melhora performance;
- usa `satisfies Prisma.ComunicadoSelect` para tipagem forte.

---

# 5. Helpers Internos

## `omitAutor()`

Remove a relação aninhada `autor` de snapshots de auditoria.

Motivo:

```txt
Evitar duplicação de dados e manter oldValue mais limpo.
```

## `auditFields()`

Mapeia `AuditUser` para o formato esperado pelo `AuditLogService`.

Campos:

- `autorId`;
- `autorNome`;
- `autorRole`;
- `ip`;
- `userAgent`.

## `deleteImagemAsync()`

Executa exclusão de imagem no Cloudinary sem bloquear a resposta.

Fluxo:

1. chama `uploadService.deleteFile(publicId)`;
2. se falhar, registra warning;
3. não propaga erro para a operação principal.

Uso:

- quando imagem de capa é substituída;
- quando comunicado é removido.

---

# 6. Criação de Comunicado

## Método

```txt
create(dto, auditUser)
```

## Fluxo

1. recebe DTO já validado e sanitizado pelo controller;
2. cria comunicado no Prisma;
3. define `autorId` a partir de `auditUser.sub`;
4. aplica `fixado = dto.fixado ?? false`;
5. usa `COMUNICADO_SELECT` no retorno;
6. dispara auditoria `CRIAR`;
7. retorna comunicado criado.

## Dados persistidos

- `titulo`;
- `conteudo`;
- `categoria`;
- `fixado`;
- `autorId`;
- `imagemCapa`.

---

# 7. Listagem Pública

## Método

```txt
findAll(query = {})
```

## Filtros

| Filtro | Regra |
|---|---|
| `titulo` | busca parcial, case-insensitive |
| `categoria` | igualdade por enum |
| `page` | página atual, padrão 1 |
| `limit` | itens por página, padrão 10 |

## Paginação

Cálculo:

```txt
skip = (page - 1) * limit
```

## Ordenação

```txt
orderBy: [
  { fixado: 'desc' },
  { criadoEm: 'desc' }
]
```

Comunicados fixados aparecem primeiro.

## Performance

Executa em paralelo:

```txt
Promise.all([
  findMany,
  count
])
```

## Retorno

```txt
data
total
page
limit
totalPages
```

---

# 8. Busca por ID

## Método

```txt
findOne(id)
```

Fluxo:

1. busca comunicado pelo ID;
2. aplica `COMUNICADO_SELECT`;
3. se não encontrar, lança `NotFoundException`;
4. retorna comunicado.

Erro:

```txt
Comunicado não encontrado.
```

---

# 9. Atualização

## Método

```txt
update(id, dto, auditUser)
```

## Fluxo

1. chama `findOne(id)` como cláusula de guarda;
2. se não existir, lança 404 antes da mutação;
3. atualiza campos enviados;
4. usa `COMUNICADO_SELECT` no retorno;
5. detecta se `imagemCapa` foi substituída;
6. remove imagem antiga em background;
7. audita `ATUALIZAR`;
8. retorna comunicado atualizado.

## Detecção de imagem substituída

Regra:

```txt
comunicadoAntigo.imagemCapa existe
AND dto.imagemCapa !== undefined
AND comunicadoAntigo.imagemCapa !== dto.imagemCapa
```

Se verdadeiro, chama `deleteImagemAsync()`.

---

# 10. Remoção

## Método

```txt
remove(id, auditUser)
```

## Fluxo

1. chama `findOne(id)` como cláusula de guarda;
2. remove comunicado do banco com `delete`;
3. se havia `imagemCapa`, remove imagem em background;
4. audita `EXCLUIR`;
5. retorna resultado do delete.

## Ponto de atenção

A remoção é física.

Não há status de arquivado ou soft delete no fluxo atual.

---

# 11. Auditoria

Ações auditadas:

| Método | Entidade | Ação |
|---|---|---|
| `create()` | `Comunicado` | `CRIAR` |
| `update()` | `Comunicado` | `ATUALIZAR` |
| `remove()` | `Comunicado` | `EXCLUIR` |

A auditoria usa:

```txt
void this.auditService.registrar(...)
```

Ou seja, não bloqueia explicitamente a resposta.

Ponto de atenção:

```txt
Não há .catch() nas chamadas de auditService.registrar().
```

Isso pode gerar promise rejection não tratada dependendo do ambiente.

---

# 12. Limpeza de Imagem no Cloudinary

A limpeza usa:

```txt
deleteImagemAsync(publicId, contexto)
```

Características:

- não bloqueia HTTP;
- falha vira warning;
- usa `UploadService.deleteFile()`;
- ocorre após update ou delete no banco.

## Risco

Se a exclusão falhar, o arquivo pode ficar órfão no Cloudinary.

## Benefício

Falha externa no Cloudinary não quebra atualização/exclusão do comunicado.

---

# 13. Segurança e Qualidade

## Segurança

Pontos fortes:

- select limita campos públicos;
- mutações são auditadas;
- conteúdo já chega sanitizado pelo controller;
- imagem de capa é HTTPS pelo DTO;
- busca por ID lança 404 controlado;
- cleanup não vaza erro externo ao usuário.

## Qualidade

Pontos positivos:

- service coeso;
- select centralizado;
- queries tipadas com Prisma;
- uso de `Promise.all()`;
- helpers reduzem duplicação;
- cláusulas de guarda antes de update/delete;
- cleanup externo isolado.

## Performance

- listagem paginada;
- count e findMany em paralelo;
- retorno com select mínimo;
- limpeza de imagem em background;
- cache é aplicado no controller.

---

# 14. Pontos de Atenção

- Auditoria fire-and-forget não possui `.catch()` explícito.
- Remoção é física, não soft delete.
- Não há campo de publicação/arquivamento.
- `comunicadosGerais` do dashboard conta comunicados deletados apenas se ainda existirem no banco; delete físico remove histórico operacional da listagem.
- Cleanup de imagem é best-effort e pode deixar arquivos órfãos.
- Não há transação envolvendo update/delete e auditoria/cleanup.

---

# 15. Melhorias Futuras

- Adicionar `.catch()` nas auditorias não bloqueantes;
- implementar soft delete ou status `arquivado`;
- criar status `rascunho/publicado`;
- adicionar agendamento de publicação;
- criar slug público;
- criar job para limpar imagens órfãs;
- criar invalidação de cache após mutações;
- criar testes unitários para filtros e ordenação;
- criar testes de cleanup assíncrono;
- criar auditoria mais robusta para deleção física.

---

# 16. Resumo Técnico Final

O `ComunicadosService` é simples, mas bem estruturado.

Ele centraliza select, usa paginação, aplica filtros, audita mutações e remove imagens antigas de forma assíncrona.

Criticidade: alta.

Complexidade: média.

A implementação é limpa e eficiente. Os principais pontos de evolução são auditoria com `.catch()`, soft delete/status de publicação, invalidação de cache e limpeza de arquivos órfãos.
