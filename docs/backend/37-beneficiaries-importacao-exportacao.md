# 37 — Beneficiaries: Importação e Exportação Excel

---

# 1. Visão Geral

## Objetivo

Documentar os fluxos de importação e exportação de alunos/beneficiários em planilhas `.xlsx` no módulo `Beneficiaries`.

Arquivos relacionados:

```txt
src/beneficiaries/beneficiaries.controller.ts
src/beneficiaries/beneficiaries.service.ts
src/beneficiaries/dto/query-beneficiary.dto.ts
```

## Responsabilidade

Os fluxos são responsáveis por:

- importar alunos por planilha modelo `.xlsx`;
- validar tipo, extensão e conteúdo real da planilha;
- limitar tamanho, linhas e colunas;
- normalizar enums vindos em português ou formato técnico;
- retornar relatório de importação;
- exportar alunos filtrados em `.xlsx`;
- aplicar os mesmos filtros da listagem;
- usar streaming na exportação;
- sanitizar nome de arquivo do header HTTP.

---

# 2. Fluxo de Importação

## Endpoint

```txt
POST /beneficiaries/import
```

Proteção:

```txt
ADMIN
SECRETARIA
```

O endpoint usa:

```txt
FileInterceptor('file')
```

## Validações no Controller

O controller aceita arquivos quando o mimetype é:

```txt
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
```

ou quando o nome termina com:

```txt
.xlsx
```

Limite de upload:

```txt
5 MB
```

Se o arquivo não for enviado, retorna erro informando que nenhuma planilha foi selecionada.

O método `validarPlanilhaXlsx()` abre o buffer com ExcelJS. Se não conseguir ler o arquivo ou se não existir worksheet, retorna mensagem pública de planilha inválida.

## Validações no Service

Método:

```txt
importFromSheet(buffer, auditUser)
```

Limites internos:

| Constante | Limite |
|---|---:|
| `MAX_IMPORT_FILE_SIZE_BYTES` | 5 MB |
| `MAX_IMPORT_ROWS` | 5000 linhas |
| `MAX_IMPORT_COLUMNS` | 80 colunas |

Se a planilha estiver vazia ou sem dados, o retorno informa erro estrutural.

## Normalização de Enums

Mapas principais:

| Mapa | Campo |
|---|---|
| `TIPO_DEFICIENCIA_MAP` | Tipo de deficiência |
| `CAUSA_DEFICIENCIA_MAP` | Causa da deficiência |
| `PREF_ACESSIBILIDADE_MAP` | Preferência de acessibilidade |
| `COR_RACA_MAP` | Cor/raça |

Exemplos:

```txt
baixa visão → BAIXA_VISAO
cegueira total → CEGUEIRA_TOTAL
fonte ampliada → FONTE_AMPLIADA
prefiro não responder → NAO_DECLARADO
```

## Relatório de Importação

Retorno esperado:

```txt
importados: number
ignorados: number
erros: { linha, documento, motivo }[]
```

Esse formato permite ao frontend apresentar resumo claro da importação.

---

# 3. Fluxo de Exportação

## Endpoint

```txt
GET /beneficiaries/export
```

Proteção:

```txt
ADMIN
SECRETARIA
```

## Query

Usa o mesmo `QueryBeneficiaryDto` da listagem, garantindo que a exportação respeite os filtros aplicados.

Filtros principais:

- busca;
- inativos;
- tipo de deficiência;
- causa;
- preferência de acessibilidade;
- precisa acompanhante;
- gênero;
- cor/raça;
- estado civil;
- cidade;
- UF;
- escolaridade;
- renda familiar;
- período de cadastro.

## Sanitização do Nome do Arquivo

O controller monta nomes como:

```txt
Alunos_Ativos_YYYY-MM-DD.xlsx
Alunos_Inativos_YYYY-MM-DD.xlsx
```

Depois sanitiza com:

```txt
replaceAll(/[^\w._-]/g, '_')
```

Isso reduz risco de header injection.

## Headers HTTP

```txt
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="..."
```

## Exportação Streaming

Método:

```txt
exportToXlsxStream(query, res)
```

Usa:

```txt
ExcelJS.stream.xlsx.WorkbookWriter
```

Características:

- escreve direto no stream da resposta Express;
- cria worksheet `Alunos`;
- congela cabeçalho;
- aplica estilos;
- usa linhas alternadas;
- executa `row.commit()`;
- finaliza com `workbook.commit()`.

## Processamento em Lotes

A exportação busca registros em lotes:

```txt
take = 1000
```

Fluxo:

1. consulta alunos filtrados;
2. adiciona linhas ao Excel;
3. faz commit das linhas;
4. incrementa `skip`;
5. continua até não haver mais registros.

---

# 4. Campos Exportados

A exportação usa `ALUNO_EXPORT_SELECT`.

Campos principais:

- nome completo;
- matrícula;
- CPF;
- RG;
- data de nascimento;
- gênero;
- estado civil;
- telefone;
- e-mail;
- endereço;
- tipo de deficiência;
- causa;
- preferência de acessibilidade;
- acompanhante;
- tecnologias assistivas;
- cor/raça;
- escolaridade;
- profissão;
- renda familiar;
- benefícios governamentais;
- status;
- data de cadastro.

---

# 5. Segurança e Qualidade

## Segurança

Pontos fortes:

- importação restrita a `ADMIN` e `SECRETARIA`;
- exportação restrita a `ADMIN` e `SECRETARIA`;
- upload limitado a 5 MB;
- aceita somente `.xlsx`;
- valida workbook real com ExcelJS;
- limita linhas e colunas;
- sanitiza filename;
- usa select específico na exportação;
- normaliza enums.

## Qualidade

- validação em camadas;
- relatório estruturado de importação;
- exportação reaproveita filtros;
- streaming reduz memória;
- suporte a valores em português facilita operação.

## Performance

- upload limitado evita grandes buffers;
- exportação usa streaming;
- exportação usa lotes de 1000 registros;
- `row.commit()` libera linhas processadas;
- select específico reduz volume de dados.

---

# 6. Regras de Negócio

- somente `.xlsx` deve ser aceito;
- planilha precisa ser legível pelo ExcelJS;
- planilha precisa ter worksheet;
- importação não pode ultrapassar 5 MB;
- importação não pode ultrapassar 5000 linhas;
- importação não pode ultrapassar 80 colunas;
- valores de enum podem vir em português ou formato técnico;
- exportação deve respeitar filtros recebidos;
- filename precisa ser sanitizado antes de ir para o header.

---

# 7. Pontos de Atenção

- Importação grande pode manter conexão aberta por tempo elevado.
- A importação atual depende de processamento síncrono da requisição.
- Exportação grande depende da estabilidade da conexão HTTP.
- Sem fila, falhas transitórias durante importação precisam ser repetidas pelo usuário.
- O layout exato da planilha modelo precisa ser documentado separadamente.

---

# 8. Melhorias Futuras

- Processar importações em fila;
- retornar protocolo de importação;
- permitir download do relatório de erros;
- armazenar histórico de importações;
- adicionar template versionado;
- exportação assíncrona para bases muito grandes.

---

# 9. Resumo Técnico Final

Os fluxos de importação e exportação do módulo `Beneficiaries` são bem estruturados.

A importação possui validação em camadas, limites defensivos e relatório de resultado. A exportação usa streaming, filtros centralizados e sanitização de headers.

Criticidade: alta.

Complexidade: alta.

Próximos passos recomendados: documentar layout oficial da planilha modelo, criar testes de arquivos inválidos/corrompidos e avaliar fila assíncrona para importações maiores.
