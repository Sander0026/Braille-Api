# Modulo: Beneficiaries / Alunos

---

# 1. Visao Geral

## Objetivo

Documentar `src/beneficiaries`, responsavel pelo cadastro completo de alunos/beneficiarios.

## Responsabilidade

Gerenciar identificacao, contato, perfil de deficiencia, compliance LGPD, dados socioeconomicos, saude, acessibilidade, importacao/exportacao e ciclo de status de alunos.

## Fluxo de Funcionamento

Controllers protegidos recebem DTOs e delegam ao service. O service normaliza CPF/RG, gera matricula anual, valida duplicidade, salva aluno, lista com filtros, exporta Excel em streaming, importa planilhas, limpa arquivos antigos e dispara regeneracao de certificados quando nome muda.

---

# 2. Arquitetura e Metodologias

## Padroes Arquiteturais Identificados

* Service Layer.
* DTO Pattern.
* Soft Delete em dois niveis (`statusAtivo`, `excluido`).
* Streaming Export.
* Bulk Import com validacao acumulada.
* Transaction Script.
* Background Task com `setImmediate`.
* Select Projection.

## Justificativa Tecnica

Aluno e uma entidade extensa e sensivel. Selects especializados evitam trafegar laudos e documentos quando a tela so precisa de listagem. Importacao em lote exige validacao por linha e atomicidade na gravacao. Exportacao em streaming evita manter planilhas grandes em memoria.

---

# 3. Fluxo Interno do Codigo

## Fluxo de Execucao

1. Criacao normaliza CPF/RG vazios para `undefined`.
2. Busca aluno por CPF/RG.
3. Se ativo, lança conflito; se inativo, retorna marcador `_reativacao`.
4. Gera matricula com retry para colisao `P2002`.
5. Salva `dataNascimento` como `Date`.
6. Registra auditoria `Aluno/CRIAR`.
7. Listagem usa `buildWhere` para filtros reaproveitados por exportacao.
8. Exportacao cria workbook streaming e pagina internamente de 1000 em 1000.
9. Atualizacao remove foto/LGPD antigos se URLs mudaram.
10. Alteracao de nome dispara regeneracao de certificados em background.
11. Importacao le planilha, interpreta linha 1 como cabecalhos, valida obrigatorios, datas, enums e duplicidade.
12. Importacao grava com transacao e matriculas sequenciais.

## Dependencias Internas

* `PrismaService`
* `AuditLogService`
* `UploadService`
* `CertificadosService`
* `gerarMatriculaAluno`
* DTOs de aluno

## Dependencias Externas

* `ExcelJS`
* `@prisma/client`
* Express `Response`

---

# 4. Dicionario Tecnico

## Variaveis

* `ALUNO_LISTA_SELECT`: campos leves para listagem.
* `ALUNO_EXPORT_SELECT`: campos de exportacao Excel.
* `ALUNO_DETALHE_INCLUDE`: inclui matriculas e turmas.
* `MAX_CREATE_RETRIES`: tentativas contra colisao de matricula.
* `TIPO_DEFICIENCIA_MAP`, `CAUSA_DEFICIENCIA_MAP`, `PREF_ACESSIBILIDADE_MAP`, `COR_RACA_MAP`: normalizacao de enums importados.
* `termoLgpdAceito`, `termoLgpdUrl`, `atestadoUrl`, `laudoUrl`: compliance/documentos.

## Funcoes e Metodos

* `buildWhere(query)`: cria filtros Prisma.
* `create(dto, auditUser)`: cadastra aluno.
* `reactivate(id, auditUser)`: restaura aluno e preserva matricula.
* `checkCpfRg(cpf, rg)`: verifica disponibilidade documental.
* `findAll(query)`: lista com paginacao.
* `exportToXlsxStream(query, res)`: gera planilha filtrada.
* `findOne(id)`: detalhe com matriculas.
* `update(id, dto, auditUser)`: atualiza aluno e limpa arquivos.
* `remove`, `restore`, `removeHard`: ciclo de status.
* `importFromSheet(buffer, auditUser)`: importa alunos de planilha.
* `normalizarEnum`: converte valores humanos ou enum literal.

## Classes

* `BeneficiariesController`
* `BeneficiariesService`
* `CreateBeneficiaryDto`
* `UpdateBeneficiaryDto`
* `QueryBeneficiaryDto`

## Interfaces e Tipagens

* Entidade Prisma `Aluno`.
* Enums `TipoDeficiencia`, `CausaDeficiencia`, `PreferenciaAcessibilidade`, `CorRaca`.
* `AuditUser`.

---

# 5. Servicos e Integracoes

## APIs

* `POST /api/beneficiaries`: cria aluno.
* `POST /api/beneficiaries/import`: importa XLSX/CSV por upload.
* `GET /api/beneficiaries`: lista.
* `GET /api/beneficiaries/check-cpf-rg`: verifica CPF/RG.
* `GET /api/beneficiaries/export`: exporta XLSX.
* `GET /api/beneficiaries/:id`: detalhe.
* `PATCH /api/beneficiaries/:id`: atualiza.
* `DELETE /api/beneficiaries/:id`: inativa.
* `POST /api/beneficiaries/:id/reactivate`: reativa.
* `PATCH /api/beneficiaries/:id/restore`: restaura.
* `DELETE /api/beneficiaries/:id/hard`: arquiva logicamente.

## Banco de Dados

Tabela `Aluno`, relacoes com `MatriculaOficina`, `Frequencia`, `Atestado`, `LaudoMedico`, `CertificadoEmitido`.

## Servicos Externos

Cloudinary para foto e documentos via `UploadService`; certificados via `CertificadosService`.

---

# 6. Seguranca e Qualidade

## Seguranca

* Rotas de mutacao exigem `ADMIN` ou `SECRETARIA`.
* Selects de listagem evitam trafegar dados medicos/documentos.
* URLs antigas de documentos sao removidas com soft fail.
* Importacao nao vaza erro bruto do Prisma.

## Qualidade

* `buildWhere` evita duplicacao entre listagem e exportacao.
* Importacao retorna `importados`, `ignorados` e erros por linha.
* Auditoria registra criacao, atualizacao e status.

## Performance

* Exportacao Excel usa stream.
* Listagem e count em paralelo.
* Importacao verifica duplicatas no banco em consulta unica.
* Regeneracao de certificado ocorre em background.

---

# 7. Regras de Negocio

* Aluno ativo nao pode duplicar CPF/RG.
* Aluno inativo com mesmo documento deve ser reativado, nao recriado.
* Nome, CPF/RG e data de nascimento sao obrigatorios na importacao.
* Importacao aceita datas serial Excel, `DD/MM/AAAA` e `AAAA-MM-DD`.
* Enums importados aceitam termos em portugues ou valor enum.
* Matricula e preservada em reativacao.

---

# 8. Pontos de Atencao Tratados

* O risco de estouro de memória na importação XLSX foi mitigado com a adoção de validadores duros de tamanho antes do parse: limite de 5MB, máximo de 5000 linhas e 80 colunas, rejeitando o processamento antes de encher a RAM.
* O bug da auditoria em lote usar a "matrícula" em vez do "ID" foi corrigido. Agora a importação realiza um `findMany` em background mapeando as matrículas geradas para os reais UUIDs recém-criados, associando os logs à PK correta.
* A confusão semântica do `removeHard` foi solucionada: o método e a intenção de inativação lógica profunda foram renomeados para `archivePermanently`, mantendo a transparência de que não ocorre exclusão física. O antigo `removeHard` está marcado como `@deprecated`.

---

# 9. Relacao com Outros Modulos

* `Turmas` matricula alunos.
* `Frequencias` registra chamadas por aluno.
* `Atestados` e `Laudos` vinculam documentos ao aluno.
* `Certificados` emite e regenera PDFs por aluno.
* `Upload` armazena arquivos.
* `AuditLog` rastreia alteracoes.

---

Beneficiaries é um dos módulos mais críticos do sistema por manipular dados pessoais e documentais sensíveis. A complexidade é alta pela quantidade de campos, importação em lote, exportação, compliance com LGPD, certificados e relações acadêmicas. O desenho é robusto e estável: com as últimas refatorações, os gargalos de memória na importação de planilhas foram blindados e os registros de auditoria foram totalmente sincronizados com os UUIDs reais, entregando um módulo extremamente seguro e performático.

