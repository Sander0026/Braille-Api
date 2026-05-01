# 35 — BeneficiariesService (`src/beneficiaries/beneficiaries.service.ts`)

---

# 1. Visão Geral

## Objetivo

Documentar o `BeneficiariesService`, serviço responsável pelas regras de negócio do módulo de alunos/beneficiários da Braille API.

## Responsabilidade

O service concentra:

- criação manual de aluno;
- validação de CPF/RG duplicado;
- geração automática de matrícula;
- retentativa contra colisão de matrícula;
- reativação preservando matrícula existente;
- listagem com filtros e paginação;
- exportação `.xlsx` em streaming;
- busca detalhada por ID;
- atualização cadastral;
- limpeza de arquivos antigos no Cloudinary;
- inativação e restauração;
- arquivamento lógico profundo;
- importação por planilha `.xlsx`;
- normalização de enums vindos da planilha;
- auditoria manual;
- regeneração de certificados quando o nome do aluno muda.

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- Service Layer;
- Prisma Repository Pattern;
- Manual Audit Pattern;
- Soft Delete Pattern;
- Select Projection Pattern;
- Excel Streaming Export Pattern;
- Batch Import Pattern;
- Retry on Unique Collision;
- Cloudinary Cleanup Pattern;
- Background Task Pattern;
- DRY Query Builder Pattern.

## Justificativa Técnica

O domínio de alunos contém dados pessoais, documentos, LGPD, acessibilidade e dados acadêmicos. Por isso, a regra de negócio fica centralizada no service.

A função `buildWhere()` evita duplicação, pois a mesma lógica de filtro é usada na listagem e na exportação.

Os selects cirúrgicos reduzem tráfego de dados e evitam carregar campos pesados quando não são necessários.

---

# 3. Fluxo Interno do Código

## Dependências Injetadas

| Dependência | Uso |
|---|---|
| `PrismaService` | Persistência de alunos |
| `AuditLogService` | Auditoria manual |
| `UploadService` | Remoção de arquivos antigos |
| `CertificadosService` | Regeneração de certificados |

## Selects Cirúrgicos

| Select | Objetivo |
|---|---|
| `ALUNO_LISTA_SELECT` | Campos leves para listagem |
| `ALUNO_EXPORT_SELECT` | Campos para exportação Excel |
| `ALUNO_DETALHE_INCLUDE` | Detalhe com matrículas/turmas |
| `ALUNO_EXISTENCIA_SELECT` | Verificação mínima de existência |
| `ALUNO_MUTATION_SELECT` | Dados para update e cleanup |

## Constantes

| Constante | Objetivo |
|---|---|
| `MAX_CREATE_RETRIES` | Até 3 tentativas contra colisão de matrícula |
| `MAX_IMPORT_FILE_SIZE_BYTES` | Limite de 5 MB |
| `MAX_IMPORT_ROWS` | Limite de 5000 linhas |
| `MAX_IMPORT_COLUMNS` | Limite de 80 colunas |

---

# 4. Métodos Principais

## `create()`

Fluxo:

1. normaliza CPF/RG;
2. verifica duplicidade por CPF/RG;
3. se aluno ativo existir, lança conflito;
4. se aluno inativo/arquivado existir, retorna `_reativacao`;
5. gera matrícula;
6. cria aluno;
7. se houver colisão de matrícula, tenta novamente;
8. registra auditoria `CRIAR`;
9. retorna aluno criado.

## `reactivate()`

Reativa aluno marcando:

```txt
statusAtivo = true
excluido = false
```

Preserva a matrícula existente. Se não houver matrícula por legado, gera uma nova.

## `checkCpfRg()`

Verifica existência de CPF/RG e retorna:

- `livre`;
- `ativo`;
- `inativo`.

## `findAll()`

Lista alunos com:

- paginação;
- filtros de `QueryBeneficiaryDto`;
- `ALUNO_LISTA_SELECT`;
- ordenação por `nomeCompleto`;
- `Promise.all()` para dados e total.

## `exportToXlsxStream()`

Exporta alunos filtrados para `.xlsx` em streaming usando `ExcelJS.stream.xlsx.WorkbookWriter`.

Características:

- escreve direto na resposta Express;
- usa lote de 1000 registros;
- usa select específico de exportação;
- aplica cabeçalho, estilos e formatação;
- evita carregar todos os registros em memória.

## `findOne()`

Busca aluno por ID com include de matrículas/oficinas e turma.

## `update()`

Fluxo:

1. busca dados atuais com `ALUNO_MUTATION_SELECT`;
2. remove foto antiga se `fotoPerfil` mudou;
3. remove termo LGPD antigo se `termoLgpdUrl` mudou;
4. atualiza dados;
5. registra auditoria `ATUALIZAR`;
6. se `nomeCompleto` mudou, agenda regeneração dos certificados em background.

## `remove()`

Inativa aluno com:

```txt
statusAtivo = false
```

Registra auditoria `EXCLUIR`.

## `restore()`

Restaura aluno com:

```txt
statusAtivo = true
```

Registra auditoria `RESTAURAR`.

## `archivePermanently()`

Executa arquivamento lógico profundo:

```txt
excluido = true
```

Registra auditoria `ARQUIVAR`.

## `removeHard()`

Método legado marcado como deprecated. Apenas delega para `archivePermanently()`.

## `importFromSheet()`

Importa alunos por `.xlsx`.

Regras principais:

- valida tamanho do arquivo;
- carrega workbook;
- valida worksheet;
- limita linhas e colunas;
- normaliza enums escritos em português ou em formato técnico;
- conta importados, ignorados e erros;
- retorna relatório estruturado.

---

# 5. Helpers e Normalizações

| Método/Mapa | Objetivo |
|---|---|
| `toAuditMeta()` | Converter `AuditUser` para campos de auditoria |
| `normalizeUniqueDoc()` | Normalizar CPF/RG |
| `getPrismaUniqueTargets()` | Identificar constraint única violada |
| `assertExists()` | Validar existência do aluno |
| `deleteFileIfChanged()` | Remover arquivo antigo do Cloudinary |
| `buildWhere()` | Montar filtro Prisma centralizado |
| `normalizarEnum()` | Normalizar enum da importação |
| `TIPO_DEFICIENCIA_MAP` | Normalizar tipo de deficiência |
| `CAUSA_DEFICIENCIA_MAP` | Normalizar causa da deficiência |
| `PREF_ACESSIBILIDADE_MAP` | Normalizar preferência de acessibilidade |
| `COR_RACA_MAP` | Normalizar cor/raça |

---

# 6. Segurança e Qualidade

## Segurança

Pontos fortes:

- CPF/RG duplicado é bloqueado;
- matrícula tem retentativa contra colisão;
- importação tem limites de tamanho, linhas e colunas;
- update remove arquivos antigos para reduzir órfãos;
- auditoria manual registra mutações;
- falha de cleanup Cloudinary não derruba operação principal;
- exportação usa select dedicado;
- filtro de data final considera Brasília.

## Qualidade

- selects centralizados;
- filtros centralizados;
- exportação streaming;
- importação com relatório;
- métodos privados coesos;
- regeneração de certificados não bloqueia update.

## Performance

- listagem paginada;
- `Promise.all()` em listagem;
- exportação em lotes de 1000;
- streaming evita carregar arquivo completo em memória;
- tasks pesadas de certificado são disparadas em background.

---

# 7. Regras de Negócio

- aluno precisa ter CPF ou RG;
- CPF/RG ativo duplicado impede criação;
- CPF/RG inativo/arquivado sinaliza reativação;
- matrícula é gerada automaticamente;
- reativação preserva matrícula existente;
- listagem padrão traz ativos;
- `inativos` lista inativos;
- `remove()` inativa;
- `archivePermanently()` marca `excluido = true`;
- exportação respeita filtros;
- importação limita volume;
- mudança de nome dispara regeneração de certificados.

---

# 8. Pontos de Atenção

- Importação em lote pode exigir fila se o volume crescer.
- `setImmediate()` para regenerar certificados não oferece retry persistente.
- Falhas de cleanup Cloudinary podem gerar arquivos órfãos pontuais.
- Exportação grande ainda pode depender do tempo da conexão HTTP.
- `removeHard()` é legado e pode confundir por não remover fisicamente.

---

# 9. Melhorias Futuras

- Fila para importação;
- fila para regeneração de certificados;
- importação transacional por lote;
- validação customizada de CPF/RG;
- relatório de erros exportável;
- paginação cursor-based;
- rotina de limpeza de arquivos órfãos;
- renomear `removeHard()`.

---

# 10. Resumo Técnico Final

O `BeneficiariesService` é um dos services mais críticos e complexos da API.

Ele gerencia cadastro, importação, exportação, auditoria, documentos, status, arquivamento e efeitos colaterais em certificados.

Criticidade: muito alta.

Complexidade: muito alta.

A implementação está profissional, com selects cirúrgicos, filtros centralizados, streaming Excel, auditoria manual e controles de segurança. Os principais próximos passos são testes de importação/filtros, documentação do modelo `.xlsx`, filas para tarefas pesadas e limpeza de arquivos órfãos.
