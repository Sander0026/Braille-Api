# 52 — AtestadosService (`src/atestados/atestados.service.ts`)

---

# 1. Visão Geral

O `AtestadosService` concentra as regras de negócio do módulo de atestados, incluindo criação transacional, justificativa automática de faltas, atualização de arquivo/motivo, remoção com reversão de frequências e auditoria manual.

Responsabilidades principais:

- validar existência do aluno;
- validar intervalo de datas;
- criar atestado;
- justificar automaticamente faltas no período;
- listar atestados por aluno;
- buscar detalhe de atestado;
- atualizar motivo e arquivo;
- remover arquivo antigo do Cloudinary quando substituído;
- remover atestado;
- reverter frequências justificadas para `FALTA`;
- simular faltas justificáveis antes da criação;
- registrar auditoria manual não bloqueante;
- retornar `ApiResponse` padronizado.

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- Service Layer;
- Transaction Pattern;
- Manual Audit Pattern;
- Best-effort External Cleanup;
- Preview Before Commit Pattern;
- Guard Clause Pattern;
- Select Projection Pattern;
- ApiResponse Wrapper Pattern;
- Domain Consistency Pattern.

## Justificativa Técnica

Atestados alteram indiretamente frequências. Por isso, criar um atestado e justificar faltas precisa ocorrer de forma atômica.

Da mesma forma, remover um atestado e reverter frequências justificadas precisa ser transacional para evitar inconsistência entre atestado e frequência.

A atualização de datas não é permitida porque mudar período exigiria recalcular justificativas aplicadas e reverter faltas que deixaram de ser cobertas.

---

# 3. Dependências

| Dependência | Uso |
|---|---|
| `PrismaService` | Persistência de atestados e frequências |
| `UploadService` | Remoção de arquivo antigo no Cloudinary |
| `AuditLogService` | Auditoria manual |

Enums/modelos usados:

- `StatusFrequencia`;
- `Aluno`;
- `AuditAcao`.

---

# 4. Constantes e Helpers

## `FREQUENCIA_SELECT`

Select mínimo reutilizado para frequências vinculadas ao atestado.

Campos:

- `id`;
- `dataAula`;
- `status`;
- `turma.id`;
- `turma.nome`.

## `registrarAuditoria()`

Registra auditoria manual com:

- entidade;
- registroId;
- ação;
- autor;
- IP;
- user agent;
- oldValue;
- newValue.

A auditoria é não bloqueante:

```txt
.catch(logger.warn)
```

Falha ao auditar não derruba a operação principal.

## `validarAluno()`

Busca o aluno por ID.

Se não existir, lança:

```txt
NotFoundException('Aluno não encontrado.')
```

## `validarIntervaloData()`

Garante:

```txt
dataFim >= dataInicio
```

Se inválido, lança `BadRequestException`.

---

# 5. Criação de Atestado

## Método

```txt
criar(alunoId, dto, auditUser)
```

## Fluxo

1. valida se aluno existe;
2. converte `dataInicio` e `dataFim` para `Date`;
3. valida intervalo;
4. inicia transação Prisma;
5. cria registro `Atestado`;
6. atualiza frequências do aluno no período com `status = FALTA`;
7. muda essas frequências para `FALTA_JUSTIFICADA`;
8. vincula `justificativaId` ao atestado criado;
9. finaliza transação;
10. registra auditoria `CRIAR`;
11. retorna `ApiResponse` com atestado e quantidade de faltas justificadas.

## Transação

Operações dentro da transação:

```txt
atestado.create
frequencia.updateMany
```

Garantia:

```txt
Se justificar faltas falhar, o atestado não fica criado isoladamente.
```

---

# 6. Listagem por Aluno

## Método

```txt
listarPorAluno(alunoId)
```

Fluxo:

1. valida existência do aluno;
2. busca atestados do aluno;
3. ordena por `dataInicio desc`;
4. inclui frequências vinculadas com `FREQUENCIA_SELECT`;
5. retorna `ApiResponse`.

---

# 7. Detalhe do Atestado

## Método

```txt
findOne(id)
```

Inclui:

- dados básicos do atestado;
- aluno com `id`, `nomeCompleto` e `matricula`;
- frequências vinculadas com select mínimo.

Se não encontrar, lança:

```txt
NotFoundException('Atestado não encontrado.')
```

---

# 8. Atualização de Atestado

## Método

```txt
atualizar(id, dto, auditUser)
```

Campos atualizáveis:

- `motivo`;
- `arquivoUrl`.

Campos não atualizáveis:

- `dataInicio`;
- `dataFim`.

## Fluxo

1. busca atestado;
2. se não existir, lança `NotFoundException`;
3. se `arquivoUrl` mudou, tenta remover arquivo antigo;
4. atualiza motivo e/ou arquivo;
5. inclui frequências vinculadas;
6. registra auditoria `ATUALIZAR`;
7. retorna `ApiResponse`.

## Cleanup de Arquivo Antigo

Se `dto.arquivoUrl` for diferente de `atestado.arquivoUrl`, o service chama:

```txt
uploadService.deleteFile(atestado.arquivoUrl)
```

Falha gera warning, mas não bloqueia update.

---

# 9. Remoção de Atestado

## Método

```txt
remover(id, auditUser)
```

## Fluxo

1. busca atestado;
2. se não existir, lança `NotFoundException`;
3. inicia transação;
4. atualiza frequências com `justificativaId = id`;
5. muda status para `FALTA`;
6. limpa `justificativaId`;
7. deleta atestado;
8. finaliza transação;
9. registra auditoria `EXCLUIR`;
10. retorna quantidade de faltas revertidas.

## Transação

Operações dentro da transação:

```txt
frequencia.updateMany
atestado.delete
```

Garantia:

```txt
Se delete falhar, as frequências não são revertidas.
```

---

# 10. Preview de Justificativas

## Método

```txt
previewJustificativas(alunoId, dataInicio, dataFim)
```

## Fluxo

1. converte datas;
2. valida se `dataInicio` é válida;
3. valida se `dataFim` é válida;
4. valida intervalo;
5. busca frequências do aluno no período com `status = FALTA`;
6. retorna total e lista de faltas.

## Objetivo

Permitir que a secretaria veja previamente quais faltas seriam justificadas antes de criar o atestado.

---

# 11. Segurança e Qualidade

## Segurança

Pontos fortes:

- criação e remoção são transacionais;
- valida existência do aluno;
- valida intervalo de datas;
- atualização não permite alterar período;
- auditoria manual registra mutações;
- cleanup externo é tolerante a falhas;
- retorno usa `ApiResponse` padronizado.

## Qualidade

Pontos positivos:

- service concentra regra de negócio;
- helpers privados reduzem duplicação;
- preview reduz erro operacional;
- selects mínimos evitam retorno pesado;
- transações evitam inconsistência acadêmica;
- auditoria é encapsulada em helper próprio.

## Performance

- `updateMany()` justifica/reverte múltiplas frequências;
- selects mínimos reduzem payload;
- transações agrupam operações relacionadas;
- listagem ordenada por `dataInicio desc` favorece leitura recente.

---

# 12. Pontos de Atenção

- Remoção faz delete físico do atestado.
- Cleanup do arquivo antigo ocorre antes do update; se update falhar depois, pode haver inconsistência externa.
- Falha ao remover arquivo antigo não bloqueia update e pode gerar órfão.
- `previewJustificativas()` valida datas manualmente, enquanto DTO não existe para essa query.
- Datas usam `new Date()`, podendo exigir padronização de fuso dependendo da regra institucional.

---

# 13. Melhorias Futuras

- Implementar soft delete para atestados.
- Criar DTO para preview com validação de datas.
- Armazenar metadados do arquivo em vez de URL simples.
- Criar fila/retry para cleanup de Cloudinary.
- Criar endpoint específico para recalcular período, se alteração de datas for necessária.
- Criar testes de transação criar/remover.
- Criar testes de reversão de frequências.

---

# 14. Resumo Técnico Final

O `AtestadosService` é crítico para manter consistência entre justificativas e frequências.

Ele cria atestados de forma transacional, justifica faltas automaticamente, permite preview e reverte frequências ao remover.

Criticidade: muito alta.

Complexidade: alta.

A implementação é profissional e consistente. Os principais próximos passos são soft delete, DTO para preview, melhoria da política de arquivo externo e testes transacionais.
