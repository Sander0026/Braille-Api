# 53 — Atestados DTOs (`src/atestados/dto/`)

---

# 1. Visão Geral

Este documento descreve os DTOs usados pelo módulo `Atestados`, responsáveis pelos contratos de entrada para criação e atualização de atestados médicos/justificativas de falta.

Arquivos documentados:

```txt
src/atestados/dto/create-atestado.dto.ts
src/atestados/dto/update-atestado.dto.ts
```

DTOs principais:

- `CreateAtestadoDto`;
- `UpdateAtestadoDto`.

Responsabilidades principais:

- validar datas do período coberto pelo atestado;
- validar motivo;
- sanitizar texto do motivo;
- validar URL do arquivo;
- limitar tamanho dos campos;
- impedir alteração de datas no PATCH;
- proteger a camada de service contra payloads malformados.

---

# 2. Sanitização

## Função `sanitizeString`

Comportamento:

- se o valor for string, remove byte nulo (`\0`);
- aplica `trim()`;
- se não for string, retorna o valor original.

Campos afetados:

- `motivo` em `CreateAtestadoDto`;
- `motivo` em `UpdateAtestadoDto`.

---

# 3. CreateAtestadoDto

Usado em:

```txt
POST /alunos/:alunoId/atestados
```

Campos:

| Campo | Validação | Obrigatório | Objetivo |
|---|---|---:|---|
| `dataInicio` | `IsDateString`, `IsNotEmpty` | Sim | Primeiro dia coberto pelo atestado |
| `dataFim` | `IsDateString`, `IsNotEmpty` | Sim | Último dia coberto pelo atestado |
| `motivo` | `IsString`, `IsNotEmpty`, `MaxLength(500)`, `Transform` | Sim | Motivo do atestado |
| `arquivoUrl` | `IsOptional`, `IsUrl`, `MaxLength(2000)` | Não | URL do PDF/imagem do atestado |

## Datas

`dataInicio` e `dataFim` exigem formato ISO.

A regra de negócio `dataFim >= dataInicio` fica no service.

## Motivo

Regras:

- obrigatório;
- string;
- não pode ser vazio;
- máximo de 500 caracteres;
- sanitizado com `sanitizeString`.

## Arquivo

`arquivoUrl` é opcional e aceita URL permissiva:

```txt
IsUrl({ require_protocol: false, require_tld: false })
MaxLength(2000)
```

Essa regra mantém compatibilidade com Cloudinary e URLs internas.

---

# 4. UpdateAtestadoDto

Usado em:

```txt
PATCH /atestados/:id
```

Campos permitidos:

| Campo | Validação | Objetivo |
|---|---|---|
| `motivo` | `IsOptional`, `IsString`, `MaxLength(500)`, `Transform` | Atualizar motivo |
| `arquivoUrl` | `IsOptional`, `IsUrl`, `MaxLength(2000)` | Atualizar URL do arquivo |

Campos não declarados no DTO:

- `dataInicio`;
- `dataFim`;
- `alunoId`;
- `registradoPorId`;
- `justificativaId`.

Com `ValidationPipe` global usando whitelist/forbid, tentativas de enviar esses campos devem ser rejeitadas.

## Por que não usar `PartialType(CreateAtestadoDto)`

A atualização é manual porque datas não devem ser alteradas em PATCH simples.

Alterar datas exigiria recalcular:

- faltas que continuam justificadas;
- faltas que devem ser revertidas;
- novas faltas cobertas pelo período;
- vínculos de `justificativaId`.

---

# 5. Relação com Service

## Criação

`CreateAtestadoDto` alimenta:

```txt
AtestadosService.criar(alunoId, dto, auditUser)
```

O service complementa com:

- validar existência do aluno;
- converter datas para `Date`;
- validar intervalo;
- criar atestado em transação;
- justificar faltas no período.

## Atualização

`UpdateAtestadoDto` alimenta:

```txt
AtestadosService.atualizar(id, dto, auditUser)
```

O service complementa com:

- buscar atestado;
- remover arquivo antigo se `arquivoUrl` mudou;
- atualizar apenas campos permitidos;
- auditar alteração.

---

# 6. Segurança e Qualidade

## Segurança

- datas obrigatórias na criação;
- motivo obrigatório na criação;
- motivo limitado a 500 caracteres;
- URL limitada a 2000 caracteres;
- remoção de byte nulo no motivo;
- PATCH não aceita datas;
- URL validada antes de chegar ao service;
- campos extras são bloqueados pelo pipe global.

## Qualidade

- DTOs pequenos e coesos;
- mensagens de validação mais claras para datas;
- atualização explicitamente restrita;
- Swagger documenta exemplos e intenção dos campos;
- sanitização reutilizada nos dois DTOs.

---

# 7. Pontos de Atenção

- `arquivoUrl` aceita URLs sem protocolo e sem TLD; útil para compatibilidade, mas menos restritivo.
- Não há DTO específico para preview; queries são validadas manualmente no service.
- Não há validação no DTO de `dataFim >= dataInicio`.
- Não há validação de domínio confiável para `arquivoUrl`.
- `motivo` pode conter HTML/texto arbitrário se enviado pelo cliente.

---

# 8. Melhorias Futuras

- Criar `PreviewAtestadoDto`.
- Criar validator customizado para `dataFim >= dataInicio`.
- Restringir `arquivoUrl` a domínios confiáveis.
- Criar DTO separado para troca de arquivo.
- Adicionar sanitização HTML se o motivo for renderizado como HTML.
- Evoluir URL simples para metadados de arquivo.

---

# 9. Resumo Técnico Final

Os DTOs de `Atestados` são objetivos e seguros para os fluxos atuais.

`CreateAtestadoDto` permite criar o período e o motivo do atestado, enquanto `UpdateAtestadoDto` restringe a edição apenas a motivo e arquivo, impedindo alteração acidental de datas.

Criticidade: alta.

Complexidade: média.
