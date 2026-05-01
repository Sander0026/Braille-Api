# 33 — Beneficiaries: Visão Geral do Módulo (`src/beneficiaries/`)

---

# 1. Visão Geral

## Objetivo

Documentar a visão geral do módulo `Beneficiaries`, responsável pela gestão de alunos/beneficiários da Braille API.

Arquivos principais:

```txt
src/beneficiaries/beneficiaries.module.ts
src/beneficiaries/beneficiaries.controller.ts
src/beneficiaries/beneficiaries.service.ts
src/beneficiaries/dto/create-beneficiary.dto.ts
src/beneficiaries/dto/update-beneficiary.dto.ts
src/beneficiaries/dto/query-beneficiary.dto.ts
src/beneficiaries/entities/beneficiary.entity.ts
```

## Responsabilidade

O módulo gerencia o ciclo de vida cadastral dos alunos/beneficiários do Instituto.

Responsabilidades principais:

- cadastrar aluno manualmente;
- importar alunos via planilha modelo `.xlsx`;
- validar CPF/RG duplicados;
- gerar matrícula do aluno automaticamente;
- listar alunos com paginação e filtros;
- consultar detalhes por ID;
- exportar alunos filtrados para `.xlsx`;
- atualizar dados cadastrais;
- remover arquivos antigos do Cloudinary quando URLs mudam;
- inativar aluno;
- restaurar aluno;
- reativar aluno inativo/arquivado;
- arquivar aluno em exclusão lógica profunda;
- registrar auditoria manual;
- regenerar certificados do aluno quando o nome muda.

## Perfis de Acesso

O controller usa `AuthGuard`, `RolesGuard` e `@SkipAudit()` na classe.

Leitura geral protegida:

- `GET /beneficiaries`;
- `GET /beneficiaries/:id`.

Operações administrativas restritas a:

```txt
ADMIN
SECRETARIA
```

Principais operações restritas:

- criar;
- importar;
- verificar CPF/RG;
- exportar;
- atualizar;
- inativar;
- reativar;
- restaurar;
- arquivar.

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- NestJS Module Pattern;
- Controller-Service Pattern;
- Service Layer;
- DTO Pattern;
- RBAC;
- Soft Delete Pattern;
- Manual Audit Pattern;
- Streaming Export Pattern;
- Excel Import Pattern;
- Select Projection Pattern;
- Cloudinary Cleanup Pattern;
- Cache Invalidation/Background Regeneration Pattern.

## Justificativa Técnica

O módulo `Beneficiaries` é um dos mais importantes do sistema, pois concentra informações pessoais, documentos, LGPD, acessibilidade, saúde visual e histórico acadêmico dos alunos.

A separação controller/service mantém a camada HTTP simples e deixa regras sensíveis no service.

O uso de selects cirúrgicos reduz tráfego de dados e evita carregar informações pesadas em listagens.

O uso de auditoria manual é adequado porque as operações envolvem entidades sensíveis e precisam de snapshots específicos.

---

# 3. Fluxo Interno do Código

## BeneficiariesModule

Importa:

- `AuditLogModule`;
- `UploadModule`;
- `CertificadosModule`.

Declara:

- `BeneficiariesController`;
- `BeneficiariesService`.

## BeneficiariesController

Base route:

```txt
/beneficiaries
```

Rotas principais:

| Método | Rota | Perfil | Responsabilidade |
|---|---|---|---|
| `POST` | `/beneficiaries` | ADMIN/SECRETARIA | Cadastrar aluno |
| `POST` | `/beneficiaries/import` | ADMIN/SECRETARIA | Importar planilha `.xlsx` |
| `GET` | `/beneficiaries` | autenticado | Listar alunos |
| `GET` | `/beneficiaries/check-cpf-rg` | ADMIN/SECRETARIA | Verificar CPF/RG |
| `GET` | `/beneficiaries/export` | ADMIN/SECRETARIA | Exportar `.xlsx` |
| `GET` | `/beneficiaries/:id` | autenticado | Buscar por ID |
| `PATCH` | `/beneficiaries/:id` | ADMIN/SECRETARIA | Atualizar aluno |
| `DELETE` | `/beneficiaries/:id` | ADMIN/SECRETARIA | Inativar aluno |
| `POST` | `/beneficiaries/:id/reactivate` | ADMIN/SECRETARIA | Reativar aluno |
| `PATCH` | `/beneficiaries/:id/restore` | ADMIN/SECRETARIA | Restaurar aluno |
| `DELETE` | `/beneficiaries/:id/hard` | ADMIN/SECRETARIA | Arquivar logicamente |

## BeneficiariesService

Responsabilidades centrais:

| Método | Responsabilidade |
|---|---|
| `create()` | Criar aluno manualmente |
| `reactivate()` | Reativar aluno preservando matrícula |
| `checkCpfRg()` | Validar existência de CPF/RG |
| `findAll()` | Listar com filtros e paginação |
| `exportToXlsxStream()` | Exportar Excel em streaming |
| `findOne()` | Buscar detalhe com turmas/matrículas |
| `update()` | Atualizar dados e limpar arquivos antigos |
| `remove()` | Inativar aluno |
| `restore()` | Restaurar aluno |
| `archivePermanently()` | Marcar `excluido = true` |
| `removeHard()` | Alias legado para arquivamento |
| `importFromSheet()` | Importar alunos via Excel |

## Selects Cirúrgicos

O service define selects constantes:

| Select | Uso |
|---|---|
| `ALUNO_LISTA_SELECT` | Listagem paginada sem dados pesados |
| `ALUNO_EXPORT_SELECT` | Campos da exportação Excel |
| `ALUNO_DETALHE_INCLUDE` | Detalhe com matrículas/oficinas |
| `ALUNO_EXISTENCIA_SELECT` | Verificação mínima de existência |
| `ALUNO_MUTATION_SELECT` | Dados mínimos para update/cleanup |

---

# 4. Dicionário Técnico

## Variáveis e Constantes

| Nome | Objetivo |
|---|---|
| `XLSX_MIME_TYPE` | Mimetype oficial do Excel `.xlsx` |
| `XLSX_EXTENSION_REGEX` | Validação por extensão `.xlsx` |
| `INVALID_XLSX_MESSAGE` | Mensagem para planilha inválida |
| `MAX_CREATE_RETRIES` | Tentativas contra colisão de matrícula |
| `MAX_IMPORT_FILE_SIZE_BYTES` | Limite de 5 MB na importação |
| `MAX_IMPORT_ROWS` | Limite de 5000 linhas na importação |
| `MAX_IMPORT_COLUMNS` | Limite de 80 colunas na importação |
| `auditUser` | Dados do usuário que executa ação |
| `where` | Filtro Prisma de listagem/exportação |

## DTOs

| DTO | Responsabilidade |
|---|---|
| `CreateBeneficiaryDto` | Validar cadastro de aluno |
| `UpdateBeneficiaryDto` | Atualização parcial de aluno |
| `QueryBeneficiaryDto` | Filtros e paginação |

## Models Envolvidos

| Model | Uso |
|---|---|
| `Aluno` | Cadastro principal do beneficiário |
| `MatriculaOficina` | Relação do aluno com turmas/oficinas |
| `Turma` | Incluída no detalhe do aluno |
| `AuditLog` | Auditoria das mutações |
| `CertificadoEmitido` | Regeneração quando nome muda |

---

# 5. Serviços e Integrações

## Banco de Dados

Model principal:

```txt
Aluno
```

Operações usadas:

- `findFirst`;
- `findUnique`;
- `findMany`;
- `count`;
- `create`;
- `update`.

## ExcelJS

Usado em dois fluxos:

- validação/leitura da planilha `.xlsx` de importação;
- exportação streaming para `.xlsx`.

## Upload/Cloudinary

`UploadService.deleteFile()` remove arquivos antigos quando `fotoPerfil` ou `termoLgpdUrl` mudam.

A falha na remoção não bloqueia a atualização principal; é registrada como warning.

## Certificados

`CertificadosService.regenerarCertificadosAluno(id)` é chamado em background quando `nomeCompleto` muda.

Isso evita certificados antigos com nome desatualizado.

## Auditoria

O controller usa `@SkipAudit()`, então o service registra auditoria manual.

Ações usadas:

- `CRIAR`;
- `RESTAURAR`;
- `ATUALIZAR`;
- `EXCLUIR`;
- `ARQUIVAR`.

---

# 6. Segurança e Qualidade

## Segurança

Pontos fortes:

- mutações restritas a `ADMIN` e `SECRETARIA`;
- importação aceita somente `.xlsx`;
- arquivo importado tem limite de 5 MB;
- workbook é carregado para validar planilha real;
- exportação sanitiza nome do arquivo para prevenir header injection;
- CPF/RG duplicado é bloqueado;
- upload antigo é removido para evitar órfãos;
- auditoria manual registra ações sensíveis;
- DTOs possuem `MaxLength` e validações de enum/URL/e-mail;
- cadastro exige CPF ou RG.

## Qualidade

Pontos positivos:

- controller fino;
- service concentra regra de negócio;
- selects cirúrgicos reduzem tráfego;
- filtros centralizados em `buildWhere()`;
- `buildWhere()` é reutilizado em listagem e exportação;
- exportação usa streaming;
- importação possui normalização de enums em português e enum técnico.

## Performance

- listagem usa paginação;
- `findAll()` usa `Promise.all()`;
- exportação usa streaming com `WorkbookWriter`;
- exportação processa lotes de 1000 registros;
- selects evitam carregar dados desnecessários;
- regeneração de certificados ocorre em background com `setImmediate()`.

---

# 7. Regras de Negócio

- aluno precisa ter CPF ou RG;
- CPF/RG ativo duplicado impede criação;
- CPF/RG de aluno inativo/arquivado sinaliza reativação;
- matrícula é gerada automaticamente;
- matrícula existente é preservada na reativação;
- listagem padrão traz apenas ativos;
- filtro `inativos` lista inativos;
- exclusão simples marca `statusAtivo = false`;
- arquivamento profundo marca `excluido = true`;
- alteração de `fotoPerfil` ou `termoLgpdUrl` remove arquivo antigo;
- alteração de nome dispara regeneração de certificados;
- importação é limitada por tamanho, linhas e colunas;
- exportação respeita filtros aplicados.

---

# 8. Pontos de Atenção

## Riscos

- `GET /beneficiaries` e `GET /beneficiaries/:id` ficam disponíveis para qualquer usuário autenticado quando não há `@Roles()` específico.
- `removeHard()` é nome legado, mas executa arquivamento lógico, não exclusão física.
- Importação em lote pode gerar carga relevante no banco dependendo da quantidade de linhas.
- Falha ao remover arquivo antigo do Cloudinary não bloqueia update, podendo deixar órfãos em casos pontuais.
- Regeneração de certificados em background precisa de monitoramento via logs.

## Débitos Técnicos

- Documentar layout oficial da planilha modelo `.xlsx` em arquivo separado.
- Criar testes e2e para importação e exportação.
- Criar testes para `buildWhere()`.
- Criar teste de RBAC garantindo mutações apenas por ADMIN/SECRETARIA.
- Avaliar fila real para regeneração de certificados em vez de `setImmediate()`.

## Melhorias Futuras

- Job/fila para importação grande;
- relatório detalhado de erros de importação;
- auditoria por linha importada ou resumo agregado;
- validação customizada de CPF/RG;
- controle transacional por lote;
- limpeza periódica de arquivos órfãos;
- paginação cursor-based para bases grandes.

---

# 9. Relação com Outros Módulos

| Módulo | Relação |
|---|---|
| `AuthGuard` | Protege rotas |
| `RolesGuard` | Restringe mutações |
| `AuditLogModule` | Registra auditoria manual |
| `UploadModule` | Remove arquivos antigos |
| `CertificadosModule` | Regenera certificados após mudança de nome |
| `TurmasModule` | Relação por matrículas em oficinas |
| `PrismaModule` | Persistência de alunos |
| Frontend | Consome cadastro, listagem, importação, exportação e detalhe |

---

# 10. Resumo Técnico Final

O módulo `Beneficiaries` é um dos núcleos de negócio da Braille API. Ele gerencia dados pessoais, documentos, acessibilidade, LGPD, importação/exportação e ciclo de vida dos alunos.

Criticidade: muito alta.

Complexidade: muito alta.

A implementação é profissional, com RBAC, auditoria manual, selects cirúrgicos, validação de planilha, exportação streaming e limpeza de arquivos antigos. Os principais pontos de evolução são documentação da planilha modelo, testes de importação/exportação, monitoramento de regeneração de certificados e possível uso de fila para tarefas pesadas.
