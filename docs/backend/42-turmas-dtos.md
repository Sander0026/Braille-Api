# 42 — Turmas DTOs (`src/turmas/dto/`)

---

# 1. Visão Geral

Documenta os DTOs do módulo `Turmas`, responsáveis pelos contratos de criação, atualização e consulta de turmas/oficinas.

Arquivos:

```txt
src/turmas/dto/create-turma.dto.ts
src/turmas/dto/update-turma.dto.ts
src/turmas/dto/query-turma.dto.ts
```

DTOs principais:

- `GradeHorariaDto`;
- `CreateTurmaDto`;
- `UpdateTurmaDto`;
- `QueryTurmaDto`.

---

# 2. GradeHorariaDto

Representa um turno semanal da turma.

Campos:

| Campo | Validação | Objetivo |
|---|---|---|
| `dia` | `IsEnum(DiaSemana)` | Dia da semana |
| `horaInicio` | `IsInt`, `Min(0)`, `Max(1439)` | Início em minutos desde meia-noite |
| `horaFim` | `IsInt`, `Min(1)`, `Max(1440)` | Fim em minutos desde meia-noite |

Exemplo:

```txt
Segunda 14:00–16:00 → { dia: 'SEG', horaInicio: 840, horaFim: 960 }
```

A validação de sobreposição e de início menor que fim ocorre no `TurmasService`.

---

# 3. CreateTurmaDto

Responsável pelo contrato de criação de turma.

Campos:

| Campo | Validação | Obrigatório | Objetivo |
|---|---|---:|---|
| `nome` | `IsString`, `IsNotEmpty` | Sim | Nome da turma |
| `descricao` | `IsString`, `IsOptional` | Não | Descrição da oficina |
| `horario` | `IsString`, `IsOptional` | Não | Texto legado de horário |
| `capacidadeMaxima` | `IsInt`, `Min(1)`, `IsOptional` | Não | Limite de alunos |
| `professorId` | `IsUUID(4)`, `IsNotEmpty` | Sim | Professor responsável |
| `gradeHoraria` | `IsArray`, `ValidateNested`, `Type` | Não | Grade estruturada |
| `dataInicio` | `IsDateString`, `IsOptional` | Não | Início da turma |
| `dataFim` | `IsDateString`, `IsOptional` | Não | Fim da turma |
| `status` | `IsEnum(TurmaStatus)`, `IsOptional` | Não | Status acadêmico inicial |
| `cargaHoraria` | `IsString`, `IsOptional` | Não | Carga horária textual |
| `modeloCertificadoId` | `IsUUID(4)`, `IsOptional` | Não | Modelo de certificado vinculado |

---

# 4. UpdateTurmaDto

Implementação:

```txt
UpdateTurmaDto extends PartialType(CreateTurmaDto)
```

Isso torna todos os campos de criação opcionais.

Uso:

```txt
PATCH /turmas/:id
```

Benefícios:

- evita duplicação de validações;
- mantém contrato consistente;
- permite atualização parcial;
- reaproveita regras de `CreateTurmaDto`.

---

# 5. QueryTurmaDto

Responsável pelos filtros de listagem.

Campos:

| Campo | Validação/Transformação | Padrão | Objetivo |
|---|---|---|---|
| `page` | `Type(Number)`, `IsInt`, `Min(1)` | `1` | Página atual |
| `limit` | `Type(Number)`, `IsInt`, `Min(1)`, `Max(100)` | `10` | Itens por página |
| `nome` | `IsString`, `IsOptional` | — | Filtrar por nome |
| `statusAtivo` | `Transform` | — | `true`, `false` ou `all` |
| `excluido` | `Transform` | — | `true`, `false` ou `all` |
| `professorId` | `IsUUID`, `IsOptional` | — | Filtrar por professor |
| `status` | `IsEnum(TurmaStatus)`, `IsOptional` | — | Filtrar por ciclo de vida |

Transformações:

```txt
' true '  → true
' false ' → false
' all '   → 'all'
outros    → undefined
```

---

# 6. Arquitetura e Metodologias

## Padrões Identificados

- DTO Pattern;
- Nested Validation Pattern;
- Partial Update Pattern;
- Query Filter Pattern;
- Enum Validation Pattern;
- Type Transformation Pattern;
- Swagger Metadata Pattern.

## Justificativa Técnica

Os DTOs garantem contratos claros antes das regras de negócio do service.

A grade horária estruturada em minutos evita ambiguidades de string e permite cálculo de colisão, carga horária e disponibilidade.

---

# 7. Segurança e Qualidade

## Segurança

Pontos fortes:

- `professorId` validado como UUID;
- `modeloCertificadoId` validado como UUID;
- status validado por enum;
- dias da semana validados por enum;
- paginação limitada a 100 itens;
- horários têm limites numéricos;
- campos extras são rejeitados pelo `ValidationPipe` global.

## Qualidade

Pontos positivos:

- contrato claro para grade horária;
- update parcial com `PartialType`;
- filtros flexíveis para status ativo/excluído;
- compatibilidade com campo legado `horario`;
- integração com Swagger.

---

# 8. Regras Representadas

- turma precisa de nome;
- turma precisa de professor válido em formato UUID;
- capacidade máxima precisa ser maior que zero;
- grade horária usa minutos desde meia-noite;
- status precisa ser valor válido de `TurmaStatus`;
- consulta pode filtrar ativas, arquivadas, ocultas ou todas;
- listagem limita retorno em até 100 itens por página.

---

# 9. Pontos de Atenção

- O DTO valida limites numéricos de horário, mas não valida sobreposição; isso fica no service.
- `horario` é legado e pode gerar ambiguidade se usado junto com `gradeHoraria`.
- `dataInicio` e `dataFim` são datas ISO, mas validação de ordem entre elas deve ficar no service ou regra futura.
- `statusAtivo` e `excluido` transformam valores inesperados em `undefined`, o que pode esconder query inválida.

---

# 10. Melhorias Futuras

- Criar validação customizada para `horaInicio < horaFim` no DTO.
- Criar validação de não sobreposição da grade no DTO ou pipe dedicado.
- Depreciar formalmente o campo textual `horario`.
- Criar validação de `dataInicio <= dataFim`.
- Tornar transformação de boolean query mais estrita.

---

# 11. Resumo Técnico Final

Os DTOs de `Turmas` são bem estruturados e fornecem base sólida para criação, edição e consulta de turmas.

Criticidade: alta.

Complexidade: média/alta.

A principal evolução recomendada é adicionar validadores customizados para consistência temporal, como `horaInicio < horaFim`, ausência de sobreposição e ordem entre datas.
