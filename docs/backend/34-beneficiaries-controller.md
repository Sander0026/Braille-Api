# 34 — BeneficiariesController (`src/beneficiaries/beneficiaries.controller.ts`)

---

# 1. Visão Geral

## Objetivo

Documentar o `BeneficiariesController`, responsável por expor as rotas HTTP do módulo de alunos/beneficiários da Braille API.

## Responsabilidade

O controller atua como camada de entrada HTTP para o domínio de alunos.

Responsabilidades principais:

- declarar endpoints `/beneficiaries`;
- aplicar autenticação JWT;
- aplicar autorização por perfil em mutações sensíveis;
- receber DTOs de criação, atualização e consulta;
- receber arquivo `.xlsx` para importação;
- validar tipo, extensão e leitura real da planilha;
- configurar exportação de alunos em `.xlsx`;
- sanitizar nome de arquivo da exportação;
- extrair dados de auditoria com `getAuditUser(req)`;
- delegar regras de negócio ao `BeneficiariesService`;
- desativar auditoria automática com `@SkipAudit()` porque o service faz auditoria manual.

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- Controller-Service Pattern;
- Thin Controller Pattern;
- RBAC;
- DTO Pattern;
- File Upload Pattern;
- Streaming Download Pattern;
- Manual Audit Pattern;
- Swagger Documentation Pattern;
- Defensive File Validation.

## Justificativa Técnica

O controller mantém a responsabilidade HTTP e deixa regras de negócio no service.

O módulo trabalha com dados sensíveis de alunos, documentos, LGPD e importação/exportação de planilhas. Por isso, as mutações são restritas a `ADMIN` e `SECRETARIA`, enquanto a leitura fica disponível para usuários autenticados conforme configuração atual do controller.

O uso de `@SkipAudit()` evita auditoria automática genérica e permite que o service registre auditoria manual com contexto mais rico.

---

# 3. Fluxo Interno do Código

## Decorators de Classe

O controller usa:

```txt
@ApiTags('Alunos (Beneficiários)')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@SkipAudit()
@Controller('beneficiaries')
```

Impacto:

- agrupa endpoints no Swagger;
- exige token Bearer;
- aplica autenticação;
- habilita autorização por roles quando `@Roles()` existe no método;
- desativa auditoria automática;
- define rota base `/beneficiaries`.

## Constantes de Validação XLSX

| Constante | Objetivo |
|---|---|
| `XLSX_MIME_TYPE` | Mimetype oficial do `.xlsx` |
| `XLSX_EXTENSION_REGEX` | Aceitar arquivos com extensão `.xlsx` |
| `INVALID_XLSX_MESSAGE` | Mensagem pública para planilha inválida |

## Rotas

| Método | Rota | Proteção | Responsabilidade |
|---|---|---|---|
| `POST` | `/beneficiaries` | `ADMIN`, `SECRETARIA` | Cadastrar aluno |
| `POST` | `/beneficiaries/import` | `ADMIN`, `SECRETARIA` | Importar alunos via `.xlsx` |
| `GET` | `/beneficiaries` | JWT | Listar alunos com filtros |
| `GET` | `/beneficiaries/check-cpf-rg` | `ADMIN`, `SECRETARIA` | Verificar CPF/RG |
| `GET` | `/beneficiaries/export` | `ADMIN`, `SECRETARIA` | Exportar alunos filtrados `.xlsx` |
| `GET` | `/beneficiaries/:id` | JWT | Buscar aluno por ID |
| `PATCH` | `/beneficiaries/:id` | `ADMIN`, `SECRETARIA` | Atualizar aluno |
| `DELETE` | `/beneficiaries/:id` | `ADMIN`, `SECRETARIA` | Inativar aluno |
| `POST` | `/beneficiaries/:id/reactivate` | `ADMIN`, `SECRETARIA` | Reativar aluno |
| `PATCH` | `/beneficiaries/:id/restore` | `ADMIN`, `SECRETARIA` | Restaurar aluno |
| `DELETE` | `/beneficiaries/:id/hard` | `ADMIN`, `SECRETARIA` | Arquivar logicamente |

## `POST /beneficiaries`

Recebe:

```txt
CreateBeneficiaryDto
```

Fluxo:

1. recebe request autenticado;
2. extrai `AuditUser` com `getAuditUser(req)`;
3. delega para `beneficiariesService.create()`.

## `POST /beneficiaries/import`

Usa `FileInterceptor('file')`.

Validações:

- tamanho máximo: 5 MB;
- mimetype oficial `.xlsx` ou extensão `.xlsx`;
- presença do arquivo;
- leitura real com `ExcelJS.Workbook().xlsx.load()`;
- existência de pelo menos uma worksheet.

Depois delega para:

```txt
beneficiariesService.importFromSheet(file.buffer, getAuditUser(req))
```

## `GET /beneficiaries/export`

Recebe filtros por `QueryBeneficiaryDto`.

Fluxo:

1. monta data atual no formato `YYYY-MM-DD`;
2. define status `Ativos` ou `Inativos`;
3. cria nome do arquivo;
4. sanitiza o filename para evitar header injection;
5. define `Content-Type` e `Content-Disposition`;
6. delega streaming para `exportToXlsxStream()`.

## `validarPlanilhaXlsx()`

Método privado do controller.

Responsabilidade:

- carregar buffer com ExcelJS;
- capturar erro de leitura;
- rejeitar planilha inválida;
- garantir worksheet inicial existente.

Essa validação complementa o `fileFilter`, pois extensão/mimetype isolados não provam que o arquivo é realmente uma planilha válida.

---

# 4. Dicionário Técnico

## Variáveis e Parâmetros

| Nome | Tipo | Objetivo |
|---|---|---|
| `dto` | `CreateBeneficiaryDto` ou `UpdateBeneficiaryDto` | Payload de aluno |
| `query` | `QueryBeneficiaryDto` | Filtros e paginação |
| `id` | string | ID do aluno |
| `file` | `Express.Multer.File` | Planilha enviada |
| `res` | `Response` | Resposta Express para streaming |
| `req` | `AuthenticatedRequest` | Request autenticado para auditoria |
| `date` | string | Data usada no nome do arquivo exportado |
| `status` | string | Ativos/Inativos no nome do arquivo |
| `filename` | string | Nome sanitizado do arquivo exportado |
| `workbook` | `ExcelJS.Workbook` | Validação da planilha importada |

## Métodos

| Método | Objetivo |
|---|---|
| `create()` | Cadastrar aluno |
| `importFromSheet()` | Receber e validar planilha |
| `findAll()` | Listar alunos |
| `checkCpfRg()` | Verificar duplicidade por CPF/RG |
| `exportXlsx()` | Exportar alunos filtrados |
| `findOne()` | Buscar aluno por ID |
| `update()` | Atualizar aluno |
| `remove()` | Inativar aluno |
| `reactivate()` | Reativar aluno |
| `restore()` | Restaurar aluno |
| `archivePermanently()` | Arquivar logicamente |
| `validarPlanilhaXlsx()` | Validar arquivo Excel real |

---

# 5. Serviços e Integrações

## APIs

Todas as rotas pertencem ao domínio:

```txt
/beneficiaries
```

## Banco de Dados

O controller não acessa banco diretamente. Ele delega ao `BeneficiariesService`, que usa `PrismaService`.

## ExcelJS

Usado no controller apenas para validação da planilha `.xlsx` antes de chamar o service.

A exportação também envolve ExcelJS, mas a geração efetiva é feita no service.

## Multer/FileInterceptor

Usado para receber o arquivo de importação no campo:

```txt
file
```

## Auditoria

O controller extrai `AuditUser` com `getAuditUser(req)` nas rotas mutáveis.

Como `@SkipAudit()` está na classe, a auditoria é manual no service.

---

# 6. Segurança e Qualidade

## Segurança

Pontos fortes:

- todas as rotas exigem JWT;
- mutações exigem `ADMIN` ou `SECRETARIA`;
- importação aceita apenas `.xlsx`;
- limite de upload de 5 MB;
- planilha é carregada com ExcelJS para validar conteúdo real;
- exportação sanitiza nome de arquivo para prevenir header injection;
- `checkCpfRg` exige CPF ou RG;
- auditoria manual registra ações sensíveis.

## Qualidade

Pontos positivos:

- controller fino;
- responsabilidades HTTP bem separadas;
- validações de arquivo no ponto de entrada;
- uso de DTOs;
- Swagger documentado;
- exportação com headers corretos;
- reuso de `QueryBeneficiaryDto` na listagem e exportação.

## Performance

- upload limitado evita consumo excessivo de memória;
- validação de planilha ocorre antes da importação;
- exportação usa streaming no service, não carrega todo o arquivo em memória no controller.

---

# 7. Regras de Negócio

- apenas `ADMIN` e `SECRETARIA` podem criar, importar, exportar, atualizar, inativar, restaurar e arquivar alunos;
- leitura exige autenticação;
- importação deve ser planilha `.xlsx` válida;
- exportação respeita filtros recebidos;
- verificação de CPF/RG exige ao menos um documento;
- arquivamento profundo não remove fisicamente o aluno, apenas delega lógica ao service;
- auditoria de mutações é responsabilidade do service.

---

# 8. Pontos de Atenção

## Riscos

- Rotas `GET /beneficiaries` e `GET /beneficiaries/:id` não têm `@Roles()` específico; ficam acessíveis a qualquer usuário autenticado.
- `fileFilter` aceita extensão `.xlsx` mesmo se mimetype não vier correto; a validação posterior com ExcelJS mitiga esse risco.
- `archivePermanently()` usa rota `DELETE /:id/hard`, mas a exclusão é lógica, não física.
- `@SkipAudit()` na classe exige que novas mutações adicionadas tenham auditoria manual no service.

## Débitos Técnicos

- Criar testes e2e de RBAC por rota.
- Criar testes de upload inválido e `.xlsx` corrompido.
- Documentar contrato da planilha modelo.
- Avaliar se leitura geral deve ter `@Roles()` explícito.

## Melhorias Futuras

- Decorator customizado para arquivo `.xlsx`;
- endpoint público/privado separado para download do modelo;
- validação por assinatura real do arquivo;
- fila assíncrona para importação;
- DTO específico para parâmetros de ID.

---

# 9. Relação com Outros Módulos

| Módulo | Relação |
|---|---|
| `BeneficiariesService` | Executa regras de negócio |
| `AuthGuard` | Autentica as rotas |
| `RolesGuard` | Autoriza mutações |
| `AuditLogModule` | Recebe auditoria manual via service |
| `UploadModule` | Lida com arquivos relacionados |
| `CertificadosModule` | Regenera certificados quando necessário |
| `Common` | Fornece `getAuditUser`, `AuthenticatedRequest` e `SkipAudit` |

---

# 10. Resumo Técnico Final

O `BeneficiariesController` está bem organizado como camada HTTP do módulo de alunos.

Ele protege rotas por JWT, restringe mutações a `ADMIN` e `SECRETARIA`, valida planilhas `.xlsx`, configura exportação segura e delega as regras ao service.

Criticidade: muito alta.

Complexidade: alta.

A implementação é profissional. Os principais cuidados futuros são testes de RBAC, validação de arquivos inválidos, documentação do modelo `.xlsx` e decisão explícita sobre permissões de leitura para todos os usuários autenticados.
