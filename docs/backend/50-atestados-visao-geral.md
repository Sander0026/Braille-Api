# 50 — Atestados: Visão Geral do Módulo (`src/atestados/`)

---

# 1. Visão Geral

O módulo `Atestados` é responsável por registrar justificativas médicas/de ausência dos alunos e aplicar automaticamente a justificativa nas frequências do período coberto.

Arquivos principais:

```txt
src/atestados/atestados.module.ts
src/atestados/atestados.controller.ts
src/atestados/atestados.service.ts
src/atestados/dto/create-atestado.dto.ts
src/atestados/dto/update-atestado.dto.ts
```

Responsabilidades principais:

- criar atestado para um aluno;
- validar existência do aluno;
- validar intervalo de datas;
- justificar automaticamente faltas no período;
- listar atestados de um aluno;
- visualizar detalhe de um atestado;
- pré-visualizar faltas que serão justificadas;
- atualizar motivo e URL do arquivo;
- impedir alteração de datas após criação;
- remover atestado;
- reverter faltas justificadas para `FALTA` ao remover;
- limpar arquivo antigo do Cloudinary quando URL muda;
- registrar auditoria manual;
- retornar respostas padronizadas com `ApiResponse`.

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- NestJS Module Pattern;
- Controller-Service Pattern;
- Thin Controller Pattern;
- Service Layer;
- DTO Pattern;
- RBAC parcial;
- Manual Audit Pattern;
- Transaction Pattern;
- Medical Certificate Justification Pattern;
- Best-effort File Cleanup Pattern;
- Preview Before Commit Pattern;
- API Response Wrapper Pattern.

## Justificativa Técnica

Atestados impactam diretamente o histórico de frequência do aluno.

Por isso, criação e remoção usam transações:

- criar atestado + justificar faltas precisa ser atômico;
- remover atestado + reverter faltas precisa ser atômico.

A atualização não permite alterar `dataInicio` e `dataFim`, pois mudar período exigiria recalcular justificativas já aplicadas. Essa decisão reduz risco de inconsistência acadêmica.

---

# 3. AtestadosModule

Importa:

- `UploadModule`;
- `AuditLogModule`.

Declara:

- `AtestadosController`;
- `AtestadosService`.

Exporta:

- `AtestadosService`.

A exportação permite uso futuro em outros módulos, como `FrequenciasModule`, se necessário.

---

# 4. AtestadosController

## Base

O controller usa:

```txt
@Controller()
```

Isso permite rotas aninhadas em caminhos diferentes:

```txt
/alunos/:alunoId/atestados
/atestados/:id
```

## Decorators

```txt
@ApiTags('Atestados (Justificativas de Falta)')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@SkipAudit()
```

Ponto importante:

- o controller aplica `AuthGuard` na classe;
- `RolesGuard` é aplicado apenas no DELETE;
- as demais rotas exigem autenticação, mas não possuem restrição explícita de role no controller.

## Rotas

| Método | Rota | Responsabilidade |
|---|---|---|
| `POST` | `/alunos/:alunoId/atestados` | Criar atestado e justificar faltas |
| `GET` | `/alunos/:alunoId/atestados` | Listar atestados do aluno |
| `GET` | `/alunos/:alunoId/atestados/preview` | Pré-visualizar faltas justificáveis |
| `GET` | `/atestados/:id` | Ver detalhe do atestado |
| `PATCH` | `/atestados/:id` | Atualizar motivo/arquivo |
| `DELETE` | `/atestados/:id` | Remover atestado e reverter faltas |

## Permissão de Remoção

A remoção usa:

```txt
@UseGuards(RolesGuard)
@Roles('ADMIN', 'SECRETARIA')
```

Isso restringe exclusão a perfis administrativos.

---

# 5. AtestadosService

Métodos principais:

| Método | Responsabilidade |
|---|---|
| `criar()` | Criar atestado e justificar faltas do período |
| `listarPorAluno()` | Listar atestados de um aluno |
| `findOne()` | Obter detalhe do atestado |
| `atualizar()` | Alterar motivo/arquivo |
| `remover()` | Remover atestado e reverter faltas |
| `previewJustificativas()` | Simular faltas justificáveis |
| `validarAluno()` | Garantir existência do aluno |
| `validarIntervaloData()` | Garantir `dataFim >= dataInicio` |
| `registrarAuditoria()` | Registrar auditoria manual não bloqueante |

---

# 6. Fluxo de Criação

Endpoint:

```txt
POST /alunos/:alunoId/atestados
```

Fluxo:

1. valida se aluno existe;
2. converte `dataInicio` e `dataFim` para `Date`;
3. valida se `dataFim >= dataInicio`;
4. inicia transação Prisma;
5. cria registro `Atestado`;
6. busca frequências do aluno no período com `status = FALTA`;
7. atualiza essas frequências para `FALTA_JUSTIFICADA`;
8. vincula `justificativaId` ao atestado criado;
9. registra auditoria `CRIAR`;
10. retorna `ApiResponse` com atestado e quantidade de faltas justificadas.

---

# 7. Fluxo de Remoção

Endpoint:

```txt
DELETE /atestados/:id
```

Fluxo:

1. busca atestado;
2. se não existir, lança `NotFoundException`;
3. inicia transação;
4. busca frequências com `justificativaId = id`;
5. reverte para `status = FALTA`;
6. limpa `justificativaId`;
7. exclui o atestado;
8. registra auditoria `EXCLUIR`;
9. retorna quantidade de faltas revertidas.

Essa operação é atômica.

---

# 8. Atualização de Atestado

Endpoint:

```txt
PATCH /atestados/:id
```

Campos editáveis:

- `motivo`;
- `arquivoUrl`.

Campos não editáveis:

- `dataInicio`;
- `dataFim`.

Motivo técnico:

```txt
Alterar datas exigiria recalcular quais frequências devem ser justificadas ou revertidas.
```

O `ValidationPipe` global com `forbidNonWhitelisted` rejeita tentativas de enviar campos não permitidos no DTO.

## Cleanup de Arquivo

Se `arquivoUrl` muda e havia arquivo antigo, o service tenta remover o antigo via:

```txt
uploadService.deleteFile(atestado.arquivoUrl)
```

Falhas geram warning, mas não bloqueiam a atualização.

---

# 9. Preview de Justificativas

Endpoint:

```txt
GET /alunos/:alunoId/atestados/preview?dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD
```

Objetivo:

- mostrar quais faltas serão justificadas antes de criar o atestado;
- permitir conferência operacional;
- reduzir erros de lançamento.

Fluxo:

1. valida datas;
2. valida intervalo;
3. busca frequências do aluno no período com `status = FALTA`;
4. retorna total e lista das faltas.

---

# 10. DTOs

## CreateAtestadoDto

Campos:

| Campo | Validação | Objetivo |
|---|---|---|
| `dataInicio` | `IsDateString`, `IsNotEmpty` | Primeiro dia coberto |
| `dataFim` | `IsDateString`, `IsNotEmpty` | Último dia coberto |
| `motivo` | `IsString`, `IsNotEmpty`, `MaxLength(500)`, `Transform` | Motivo |
| `arquivoUrl` | `IsUrl`, `MaxLength(2000)`, `IsOptional` | URL do arquivo |

## UpdateAtestadoDto

Campos:

| Campo | Validação | Objetivo |
|---|---|---|
| `motivo` | `IsString`, `MaxLength(500)`, `Transform`, `IsOptional` | Motivo atualizado |
| `arquivoUrl` | `IsUrl`, `MaxLength(2000)`, `IsOptional` | Arquivo atualizado |

---

# 11. Segurança e Qualidade

## Segurança

Pontos fortes:

- rotas exigem autenticação;
- remoção restrita a ADMIN/SECRETARIA;
- create/remove são transacionais;
- datas são validadas;
- motivo é sanitizado removendo byte nulo e espaços;
- URL tem limite de tamanho;
- arquivo antigo é removido quando substituído;
- auditoria manual registra criação, atualização e exclusão.

## Qualidade

Pontos positivos:

- controller fino;
- service concentra regra de negócio;
- preview evita erro operacional;
- `FREQUENCIA_SELECT` evita duplicação de select;
- `validarAluno()` centraliza checagem de aluno;
- `validarIntervaloData()` centraliza regra de datas;
- `ApiResponse` padroniza retorno.

## Performance

- `updateMany()` justifica/reverte múltiplas frequências eficientemente;
- transação evita estados parciais;
- selects mínimos reduzem dados retornados.

---

# 12. Pontos de Atenção

## Riscos

- Rotas de criar, listar, preview, detalhar e atualizar não têm `RolesGuard`; qualquer usuário autenticado pode acessá-las conforme implementação atual.
- `DELETE` usa roles como strings, não enum `Role`.
- Remoção exclui o atestado fisicamente.
- Atualizar `arquivoUrl` remove arquivo antigo antes de atualizar o banco; se a atualização falhar depois da deleção, pode haver inconsistência externa.
- Falha ao deletar arquivo antigo não bloqueia update, podendo deixar órfão.

## Débitos Técnicos

- Definir matriz de acesso explícita para atestados.
- Avaliar soft delete para atestados.
- Avaliar transação/ordem segura para troca de arquivo.
- Criar testes de criação/remover com reversão de frequência.
- Criar testes de preview.

---

# 13. Melhorias Futuras

- Aplicar `RolesGuard` em todas as rotas sensíveis;
- padronizar roles com enum `Role`;
- implementar soft delete de atestado;
- versionar documentos de atestado;
- armazenar metadados de arquivo em vez de URL simples;
- usar fila/retry para cleanup de Cloudinary;
- permitir recalcular período com endpoint específico, se necessário;
- auditar preview se a política exigir rastreio de consulta sensível.

---

# 14. Resumo Técnico Final

O módulo `Atestados` é crítico para a integridade do histórico de frequência.

Ele cria justificativas em transação, atualiza faltas automaticamente, permite preview e reverte faltas ao remover o atestado.

Criticidade: muito alta.

Complexidade: alta.

A implementação é profissional nas regras transacionais e na separação controller/service. Os principais pontos de evolução são matriz de permissões mais explícita, soft delete, testes de reversão e política mais robusta para arquivos externos.
