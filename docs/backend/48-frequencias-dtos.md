# 48 — Frequências DTOs (`src/frequencias/dto/`)

---

# 1. Visão Geral

Este documento descreve os DTOs do módulo `Frequencias`, responsáveis pelos contratos de entrada para chamada individual, chamada em lote, atualização e filtros de consulta.

Arquivos documentados:

```txt
src/frequencias/dto/create-frequencia.dto.ts
src/frequencias/dto/create-frequencia-lote.dto.ts
src/frequencias/dto/update-frequencia.dto.ts
src/frequencias/dto/query-frequencia.dto.ts
```

DTOs principais:

- `CreateFrequenciaDto`;
- `FrequenciaAlunoBadgeDto`;
- `CreateFrequenciaLoteDto`;
- `UpdateFrequenciaDto`;
- `QueryFrequenciaDto`.

---

# 2. CreateFrequenciaDto

Responsável pelo registro individual de chamada.

Campos:

| Campo | Validação | Obrigatório | Objetivo |
|---|---|---:|---|
| `dataAula` | `IsDateString` | Sim | Data da aula em formato ISO |
| `status` | `IsEnum(StatusFrequencia)`, `IsOptional` | Não | Status oficial da frequência |
| `presente` | `ValidateIf`, `IsBoolean` | Condicional | Campo legado booleano |
| `observacao` | `IsString`, `IsOptional` | Não | Observação/justificativa textual |
| `alunoId` | `IsUUID` | Sim | ID do aluno |
| `turmaId` | `IsUUID` | Sim | ID da turma/oficina |

## Status oficial

Campo preferencial:

```txt
status: StatusFrequencia
```

Ele substitui o campo legado `presente`.

## Campo legado `presente`

Mantido temporariamente para compatibilidade com o frontend atual.

Regra de validação:

```txt
ValidateIf(dto.status === undefined)
```

Ou seja, `presente` só é exigido/validado quando `status` não foi informado.

---

# 3. FrequenciaAlunoBadgeDto

Representa cada aluno dentro da chamada em lote.

Campos:

| Campo | Validação | Obrigatório | Objetivo |
|---|---|---:|---|
| `alunoId` | `IsUUID` | Sim | ID do aluno |
| `status` | `IsEnum(StatusFrequencia)`, `IsOptional` | Não | Status oficial |
| `presente` | `ValidateIf`, `IsBoolean` | Condicional | Campo legado |
| `frequenciaId` | `IsUUID`, `IsOptional` | Não | ID de chamada existente |

Ponto técnico: `frequenciaId` existe no DTO para compatibilidade/upsert, mas o service atual prioriza busca por `turmaId + dataAula + alunoId`.

---

# 4. CreateFrequenciaLoteDto

Responsável pelo registro ou atualização em lote.

Campos:

| Campo | Validação | Obrigatório | Objetivo |
|---|---|---:|---|
| `dataAula` | `IsDateString` | Sim | Data da aula |
| `turmaId` | `IsUUID` | Sim | Turma/oficina |
| `alunos` | `IsArray`, `ValidateNested`, `Type` | Sim | Lista de alunos e status |

O uso de `ValidateNested({ each: true })` garante validação individual de cada item da lista.

---

# 5. UpdateFrequenciaDto

Implementação:

```txt
UpdateFrequenciaDto extends PartialType(CreateFrequenciaDto)
```

Isso transforma todos os campos de criação em opcionais.

Uso:

```txt
PATCH /frequencias/:id
```

Benefícios:

- permite edição parcial;
- evita duplicação de validações;
- mantém contrato alinhado ao DTO de criação.

---

# 6. QueryFrequenciaDto

Responsável pelos filtros de listagem e resumo.

Campos:

| Campo | Validação/Transformação | Padrão | Objetivo |
|---|---|---|---|
| `page` | `Type(Number)`, `IsInt`, `Min(1)` | `1` | Página atual |
| `limit` | `Type(Number)`, `IsInt`, `Min(1)`, `Max(100)` | `20` | Itens por página |
| `turmaId` | `IsString`, `IsOptional` | — | Filtrar por turma |
| `alunoId` | `IsString`, `IsOptional` | — | Filtrar por aluno |
| `dataAula` | `IsDateString`, `IsOptional` | — | Filtrar por data |
| `professorId` | `IsUUID`, `IsOptional` | — | Filtrar por professor |

Ponto de atenção: `turmaId` e `alunoId` são strings, enquanto `professorId` é validado como UUID.

---

# 7. Arquitetura e Metodologias

## Padrões Identificados

- DTO Pattern;
- Nested Validation Pattern;
- Partial Update Pattern;
- Query Filter Pattern;
- Legacy Compatibility Pattern;
- Enum Validation Pattern;
- Swagger Metadata Pattern.

## Justificativa Técnica

Os DTOs suportam uma migração gradual do campo legado `presente` para o enum oficial `StatusFrequencia`.

Essa abordagem reduz risco de quebra no frontend e permite que o backend normalize os dois formatos durante o período de transição.

---

# 8. Segurança e Qualidade

## Segurança

Pontos fortes:

- IDs principais são validados como UUID em criação/lote;
- status oficial validado por enum;
- data da aula validada como data ISO;
- limite de paginação máximo 100;
- nested validation no lote;
- campos extras são rejeitados pelo `ValidationPipe` global.

## Qualidade

Pontos positivos:

- DTOs claros e pequenos;
- compatibilidade com legado bem sinalizada;
- update parcial com `PartialType`;
- lote com DTO específico;
- documentação Swagger aponta depreciação de `presente`.

---

# 9. Regras Representadas

- chamada individual exige aluno, turma e data;
- chamada individual exige `status` ou `presente` legado;
- lote exige turma, data e lista de alunos;
- cada aluno do lote exige `alunoId` e status/presente;
- atualização é parcial;
- listagem tem paginação máxima de 100 itens;
- professor pode ser usado como filtro de consulta.

---

# 10. Pontos de Atenção

- `turmaId` e `alunoId` em `QueryFrequenciaDto` poderiam ser `IsUUID` para consistência.
- `observacao` não possui `MaxLength`.
- `alunos` no lote não possui limite máximo no DTO.
- `status` e `presente` podem coexistir; o service prioriza `status`.
- `presente` deve ser removido quando frontend migrar totalmente para `status`.

---

# 11. Melhorias Futuras

- Trocar `turmaId` e `alunoId` de query para `IsUUID`.
- Adicionar limite máximo de alunos por lote.
- Adicionar `MaxLength` em `observacao`.
- Criar validação que exija explicitamente `status` ou `presente`.
- Remover `presente` após migração.
- Criar DTO específico para fechar/reabrir diário.

---

# 12. Resumo Técnico Final

Os DTOs de `Frequencias` estão bem estruturados para suportar chamadas individuais, chamadas em lote e filtros.

O ponto mais importante é a transição entre o campo legado `presente` e o enum oficial `StatusFrequencia`.

Criticidade: alta.

Complexidade: média.

As principais melhorias recomendadas são fortalecer validações UUID nas queries, limitar tamanho do lote, adicionar tamanho máximo para observação e remover gradualmente o campo legado `presente`.
