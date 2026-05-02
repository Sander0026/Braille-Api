# 63 — Certificados DTOs (`src/certificados/dto/`)

---

# 1. Visão Geral

Este documento descreve os DTOs do módulo `Certificados`, responsáveis pelos contratos de entrada para criação/atualização de modelos e emissão de certificados acadêmicos e de honraria.

Arquivos documentados:

```txt
src/certificados/dto/create-certificado.dto.ts
src/certificados/dto/update-certificado.dto.ts
src/certificados/dto/emitir-academico.dto.ts
src/certificados/dto/emitir-honraria.dto.ts
```

DTOs principais:

- `CreateCertificadoDto`;
- `UpdateCertificadoDto`;
- `EmitirAcademicoDto`;
- `EmitirHonrariaDto`.

---

# 2. Sanitização Compartilhada

Os DTOs usam uma função `trim` local.

Comportamento:

```txt
se value for string:
  remove byte nulo \0
  aplica trim()
caso contrário:
  retorna valor original
```

Objetivo:

- remover caracteres nulos;
- evitar espaços acidentais;
- padronizar texto antes da validação/persistência.

---

# 3. CreateCertificadoDto

Usado em:

```txt
POST /modelos-certificados
```

Campos:

| Campo | Validação | Obrigatório | Objetivo |
|---|---|---:|---|
| `nome` | `IsString`, `IsNotEmpty`, `MaxLength(150)`, `Transform` | Sim | Nome descritivo do modelo |
| `textoTemplate` | `IsString`, `IsNotEmpty`, `MaxLength(5000)`, `Transform` | Sim | Corpo textual com variáveis |
| `nomeAssinante` | `IsString`, `IsNotEmpty`, `MaxLength(150)`, `Transform` | Sim | Nome do assinante principal |
| `cargoAssinante` | `IsString`, `IsNotEmpty`, `MaxLength(150)`, `Transform` | Sim | Cargo do assinante principal |
| `nomeAssinante2` | `IsOptional`, `IsString`, `MaxLength(150)`, `Transform` | Não | Nome do segundo assinante |
| `cargoAssinante2` | `IsOptional`, `IsString`, `MaxLength(150)`, `Transform` | Não | Cargo do segundo assinante |
| `layoutConfig` | `IsOptional`, `IsString`, `MaxLength(10000)` | Não | JSON serializado do layout visual |
| `tipo` | `IsEnum(TipoCertificado)` | Sim | Natureza do certificado |

## `textoTemplate`

Texto base do certificado com variáveis.

Acadêmico:

- `{{ALUNO}}`;
- `{{TURMA}}`;
- `{{CARGA_HORARIA}}`;
- `{{DATA_INICIO}}`;
- `{{DATA_FIM}}`.

Honraria:

- `{{PARCEIRO}}`;
- `{{MOTIVO}}`;
- `{{DATA}}`.

## `layoutConfig`

Recebe JSON serializado como string.

O DTO valida apenas:

- ser string;
- tamanho máximo de 10000 caracteres.

O parse ocorre no service.

---

# 4. UpdateCertificadoDto

Implementação:

```txt
UpdateCertificadoDto extends PartialType(CreateCertificadoDto)
```

Isso torna todos os campos de criação opcionais.

Usado em:

```txt
PATCH /modelos-certificados/:id
```

Benefícios:

- evita duplicação de validações;
- permite atualização parcial;
- mantém contrato alinhado à criação;
- reaproveita sanitização e limites.

---

# 5. EmitirAcademicoDto

Usado em:

```txt
POST /modelos-certificados/emitir-academico
```

Campos:

| Campo | Validação | Obrigatório | Objetivo |
|---|---|---:|---|
| `turmaId` | `IsUUID`, `IsNotEmpty` | Sim | ID da turma concluída |
| `alunoId` | `IsUUID`, `IsNotEmpty` | Sim | ID do aluno matriculado |

O DTO valida formato UUID.

As regras de negócio ficam no service:

- turma existe;
- aluno cursa a turma;
- turma ou matrícula está concluída;
- turma possui modelo;
- frequência mínima é suficiente.

---

# 6. EmitirHonrariaDto

Usado em:

```txt
POST /modelos-certificados/emitir-honraria
```

Campos:

| Campo | Validação | Obrigatório | Objetivo |
|---|---|---:|---|
| `modeloId` | `IsUUID('4')`, `IsNotEmpty` | Sim | Modelo do tipo HONRARIA |
| `nomeParceiro` | `IsNotEmpty`, `MaxLength(200)`, `Transform` | Sim | Nome do homenageado/parceiro |
| `motivo` | `IsNotEmpty`, `MaxLength(1000)`, `Transform` | Sim | Motivo da homenagem |
| `dataEmissao` | `IsDateString`, `IsNotEmpty` | Sim | Data do evento/emissão |

O service complementa com:

- modelo existe;
- modelo é do tipo `HONRARIA`;
- PDF é gerado com as tags corretas.

---

# 7. Segurança e Qualidade

## Segurança

- IDs validados como UUID;
- tipo validado por enum;
- textos obrigatórios na criação;
- limites de tamanho reduzem payload abusivo;
- byte nulo é removido;
- data de honraria validada como ISO;
- campos extras são bloqueados pelo `ValidationPipe` global.

## Qualidade

- DTOs claros e pequenos;
- metadados Swagger úteis;
- update parcial com `PartialType`;
- sanitização consistente;
- separação entre DTOs de modelo e DTOs de emissão.

---

# 8. Pontos de Atenção

- `layoutConfig` é validado apenas como string, sem schema JSON.
- `CreateCertificadoDto.tipo` não define valor default real no DTO, apenas no Swagger.
- `EmitirAcademicoDto` usa `IsUUID(undefined)`, aceitando qualquer versão válida; `EmitirHonrariaDto` exige UUID v4.
- `nomeParceiro` e `motivo` não possuem `IsString()`, embora tenham `MaxLength` e `Transform`.
- Tags obrigatórias no `textoTemplate` não são validadas.
- Não há validação de HTML/sanitização semântica do texto do certificado.

---

# 9. Melhorias Futuras

- Validar `layoutConfig` com JSON Schema;
- padronizar UUID v4 nos DTOs;
- adicionar `IsString()` em `nomeParceiro` e `motivo`;
- validar presença de tags mínimas por tipo de certificado;
- criar DTO específico para `layoutConfig` em vez de string livre;
- adicionar sanitização HTML se templates forem renderizados em HTML no frontend;
- validar `tipo` default no service ou schema Prisma de forma explícita.

---

# 10. Resumo Técnico Final

Os DTOs de `Certificados` fornecem uma fronteira sólida para criação de modelos e emissão de certificados.

Eles validam IDs, textos, datas, enum e tamanhos, além de aplicar sanitização básica por remoção de byte nulo e trim.

Criticidade: alta.

Complexidade: média.
