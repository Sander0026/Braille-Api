# Módulo: Beneficiários (Alunos)

---

# 1. Visão Geral

## Objetivo
Gerenciar o cadastro completo dos alunos com deficiência visual do instituto: criação, atualização, inativação, arquivamento permanente (LGPD), importação em massa via planilha Excel/CSV e exportação de relatórios.

## Responsabilidade
É o modelo de dados mais rico do sistema, agrupando informações pessoais, de saúde, socioeconômicas, de acessibilidade e legais. Toda a operação acadêmica (turmas, frequências, certificados) orbita ao redor deste módulo.

---

# 2. Arquitetura e Metodologias

## Padrões Identificados
- **Surgical SELECT por caso de uso:** 5 constantes de select diferentes (`ALUNO_LISTA_SELECT`, `ALUNO_EXPORT_SELECT`, `ALUNO_DETALHE_INCLUDE`, `ALUNO_EXISTENCIA_SELECT`, `ALUNO_MUTATION_SELECT`)
- **Retry com colisão de matrícula:** `create()` tenta até 3 vezes se houver colisão na geração de matrícula única
- **Streaming Excel:** `exportToXlsxStream()` usa `ExcelJS.stream.xlsx.WorkbookWriter` — pagina 1000 alunos por vez para não explodir memória
- **Auto-detecção de duplicata:** `create()` detecta aluno existente inativo/arquivado e retorna flag `_reativacao: true`
- **Invalidação de cache por nome:** ao alterar nome do aluno, regenera certificados emitidos em background
- **Import com mapeamento de enums em PT-BR:** planilha pode usar valores em português e o sistema normaliza

---

# 3. Fluxo Interno

## Criação (`POST /api/beneficiaries`)
```
1. Normaliza CPF e RG (remove formatação)
2. Verifica existência por CPF/RG:
   - Ativo → ConflictException
   - Inativo/arquivado → retorna {_reativacao: true} com dados do aluno existente
3. Gera matrícula única (gerarMatriculaAluno) — formato: A + ano + sequencial
4. Cria aluno com retry (3 tentativas) para colisão de matrícula
5. Registra auditoria de CRIAR
```

## Atualização (`PATCH /api/beneficiaries/:id`)
```
1. Busca dados atuais (select cirúrgico: fotoPerfil + termoLgpdUrl + nomeCompleto)
2. Em paralelo: deleta foto antiga e/ou termo LGPD antigo se URL mudou
3. Atualiza aluno
4. Se nome mudou → regenera certificados emitidos em background (setImmediate)
5. Registra auditoria de ATUALIZAR com oldValue e newValue
```

## Exportação Excel (`GET /api/beneficiaries/export`)
```
1. Aplica mesmos filtros de buildWhere() que findAll()
2. Cria WorkbookWriter em streaming (header → Response HTTP)
3. Carrega 1000 alunos por iteração (evita OOM)
4. Zebra styling: linhas ímpares com fundo azul claro
5. Fecha workbook e finaliza stream
```

## Importação de Planilha Legacy (`POST /api/beneficiaries/import`)
```
1. Valida tamanho: máx. 5MB
2. Valida linhas: máx. 5000
3. Valida colunas: máx. 80
4. Linha 0 = labels (ignorada), Linha 1 = cabeçalhos, Linha 2+ = dados
5. Para cada linha:
   a. Valida campos obrigatórios (NomeCompleto, DataNascimento)
   b. Verifica duplicata intra-planilha (CPF/RG)
   c. Verifica duplicata no banco (CPF/RG)
   d. Normaliza enums (PT-BR → valor do banco)
   e. Cria aluno ou registra erro na linha
6. Retorna: {importados, ignorados, erros[]}
```

## Importação em Lotes via JSON (`POST /api/beneficiaries/import-batch`) - Recomendado
```
1. Recebe um Array JSON extraído e particionado pelo Frontend (Lotes de 200/500).
2. Sem limite rígido de arquivo ou memória, pois delega o parseamento XLSX para o cliente.
3. Processa cada lote de JSON (reaproveitando a inteligência e validação da importação legada).
4. Utiliza transação Prisma extendida (`maxWait: 10000`, `timeout: 20000`) para suportar a latência de nuvem.
5. Utiliza `skipDuplicates: true` no `createMany` para garantir resiliência contra violações de constraint (`CPF`/`RG` únicos) em operações massivas concorrentes.
6. Retorna o payload: {importados, ignorados, erros[]} para contabilização progressiva no UI.
```

---

# 4. Dicionário Técnico

## Constantes de SELECT

| Constante | Uso | Campos |
|---|---|---|
| `ALUNO_LISTA_SELECT` | Listagem paginada | id, nome, cpf, rg, matrícula, telefone, tipoDeficiência, status, criadoEm |
| `ALUNO_EXPORT_SELECT` | Exportação Excel | ~25 campos sem campos médicos sensíveis |
| `ALUNO_DETALHE_INCLUDE` | GET /:id | Todos os campos + `matriculasOficina` com turma |
| `ALUNO_EXISTENCIA_SELECT` | Verificação pré-mutação | Apenas `id` |
| `ALUNO_MUTATION_SELECT` | PATCH | `id, fotoPerfil, termoLgpdUrl, nomeCompleto` |

## Limites de Importação

| Constante | Valor | Proteção |
|---|---|---|
| `MAX_CREATE_RETRIES` | 3 | Colisão de matrícula gerada |
| `MAX_IMPORT_FILE_SIZE_BYTES` | 5MB | ReDoS/DoS por arquivo gigante |
| `MAX_IMPORT_ROWS` | 5000 | Timeout de transação (Aplicável apenas ao endpoint de `.xlsx` server-side) |
| `MAX_IMPORT_COLUMNS` | 80 | Parse excessivo |

## Mapeamento de Enums da Importação

A planilha pode usar valores em português legível:
- `"cegueira total"` → `CEGUEIRA_TOTAL`
- `"baixa visão"` → `BAIXA_VISAO`
- `"congênita"` → `CONGENITA`
- `"braille"` → `BRAILLE`
- `"não declarado"` → `NAO_DECLARADO`

## Métodos Principais

| Método | Descrição |
|---|---|
| `create(dto, auditUser?)` | Criação com detecção de duplicata e retry de matrícula |
| `reactivate(id, auditUser?)` | Reativa aluno inativo preservando a matrícula original |
| `checkCpfRg(cpf?, rg?)` | Verifica disponibilidade de documentos antes do cadastro |
| `findAll(query)` | Listagem paginada com 14 filtros disponíveis |
| `exportToXlsxStream(query, res)` | Exportação Excel em streaming (sem limite de registros) |
| `findOne(id)` | Detalhe completo incluindo turmas e matrículas |
| `update(id, dto, auditUser?)` | Atualização com cleanup de Cloudinary e invalidação de cache |
| `remove(id, auditUser?)` | Soft delete: `statusAtivo: false` |
| `restore(id, auditUser?)` | Restauração: `statusAtivo: true` |
| `archivePermanently(id, auditUser?)` | Arquivamento LGPD: `excluido: true` |
| `importFromSheet(buffer, auditUser?)` | Importação em massa com relatório de erros |

---

# 5. Endpoints da API

| Método | Rota | Guard | Roles | Descrição |
|---|---|---|---|---|
| `POST` | `/api/beneficiaries` | `AuthGuard` | `ADMIN, SECRETARIA` | Criar aluno |
| `GET` | `/api/beneficiaries` | `AuthGuard` | Todos | Listar com filtros e paginação |
| `GET` | `/api/beneficiaries/export` | `AuthGuard` | `ADMIN, SECRETARIA` | Exportar Excel |
| `GET` | `/api/beneficiaries/check-documento` | `AuthGuard` | `ADMIN, SECRETARIA` | Verificar CPF/RG |
| `GET` | `/api/beneficiaries/:id` | `AuthGuard` | Todos | Detalhe completo |
| `PATCH` | `/api/beneficiaries/:id` | `AuthGuard` | `ADMIN, SECRETARIA` | Atualizar aluno |
| `DELETE` | `/api/beneficiaries/:id` | `AuthGuard` | `ADMIN, SECRETARIA` | Inativar (soft delete) |
| `PATCH` | `/api/beneficiaries/:id/restaurar` | `AuthGuard` | `ADMIN` | Restaurar aluno inativo |
| `DELETE` | `/api/beneficiaries/:id/hard` | `AuthGuard` | `ADMIN` | Arquivar permanentemente (LGPD) |
| `POST` | `/api/beneficiaries/import` | `AuthGuard` | `ADMIN, SECRETARIA` | Importação via planilha (Server-side Parse) |
| `POST` | `/api/beneficiaries/import-batch` | `AuthGuard` | `ADMIN, SECRETARIA` | Importação rápida via Lotes JSON |

---

# 6. Banco de Dados

## Tabela `Aluno` — Campos por Categoria

**Identificação:** `matricula`, `nomeCompleto`, `dataNascimento`, `cpf`, `rg`, `genero`, `estadoCivil`, `corRaca`

**Contato:** `cep`, `rua`, `numero`, `complemento`, `bairro`, `cidade`, `uf`, `telefoneContato`, `email`, `contatoEmergencia`

**Deficiência:** `tipoDeficiencia`, `causaDeficiencia`, `idadeOcorrencia`, `possuiLaudo`, `laudoUrl`, `tecAssistivas`, `prefAcessibilidade`

**LGPD:** `termoLgpdAceito`, `termoLgpdAceitoEm`, `termoLgpdUrl`

**Socioeconômico:** `escolaridade`, `profissao`, `rendaFamiliar`, `beneficiosGov`, `composicaoFamiliar`

**Saúde:** `precisaAcompanhante`, `acompOftalmologico`, `outrasComorbidades`

**Controle:** `statusAtivo`, `excluido`, `fotoPerfil`, `criadoEm`, `atualizadoEm`

## Fix de Timezone na Busca por Data
```typescript
// dataCadastroFim: cobre até 23:59:59 do dia no fuso de Brasília
lte: new Date(`${dataCadastroFim}T23:59:59.999-03:00`)
```

---

# 7. Regras de Negócio

1. **Duplicata por CPF/RG:** não cria aluno duplicado; retorna o existente para possível reativação
2. **Matrícula única:** formato `A{ANO}{SEQUENCIAL}` — até 3 retentativas em caso de colisão
3. **Dois níveis de exclusão:** `statusAtivo=false` (inativo reversível) vs `excluido=true` (arquivado por LGPD — irreversível normalmente)
4. **Reativação preserva matrícula:** `reactivate()` mantém a matrícula original do aluno
5. **Invalidação de cache por nome:** alterar o nome regenera todos os certificados emitidos com o nome antigo
6. **Importação tolerante a erros:** linhas com erro são registradas no relatório; as válidas são importadas
7. **Exportação sem limite:** streaming por páginas de 1000 evita timeout e OOM

---

# 8. Pontos de Atenção

> [!WARNING]
> **`_reativacao: true`:** O frontend deve tratar este flag explicitamente. Receber um objeto com `_reativacao: true` significa que o aluno já existe e está inativo — o UI deve perguntar se deseja reativar.

> [!NOTE]
> **Regeneração de certificados em `setImmediate`:** A regeneração é assíncrona e não bloqueia a resposta. Falhas são logadas como `warn` e não propagadas ao cliente.

> [!IMPORTANT]
> **Exportação Excel consome memória progressiva:** O streaming evita carregar tudo em memória, mas 5000 alunos ainda representam carga significativa. Monitorar tempo de resposta em instituições grandes.

---

# 9. Resumo Técnico Final

O módulo de beneficiários é o **mais extenso do sistema** (1019 linhas de service). Sua riqueza de dados exige múltiplas estratégias de select cirúrgico e streaming para garantir performance. O fluxo de detecção de duplicata e reativação é uma decisão de UX sofisticada que evita o erro de registro duplicado.

**Criticidade:** 🔴 Máxima | **Complexidade:** Alta | **Testes:** `beneficiaries.service.spec.ts`, `beneficiaries.controller.spec.ts`
