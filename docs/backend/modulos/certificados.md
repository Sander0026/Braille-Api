# Modulo: Certificados

---

# 1. Visao Geral

## Objetivo

Gerenciar modelos de certificados, emissao de certificados academicos e honrarias em PDF, QR Code de validacao publica, cancelamento, reemissao e a base de transicao para layouts flexiveis.

## Estado arquitetural atual

O modulo esta em estado de transicao controlada:

- Fluxo funcional atual: `ModeloCertificado` e `CertificadoEmitido`.
- Layout oficial: `layoutConfig.elements`, usado pelo editor visual, validacao backend e PDF.
- Compatibilidade de banco: `ModeloCertificado` e `CertificadoEmitido` continuam sendo as tabelas funcionais.
- Base futura V2 no Prisma: `CertificateTemplate`, `CertificateLayout`, `CertificateSignature`, `Certificate`, `CertificateHistory` e `CertificateBatch`.

> Importante: as tabelas V2 ja existem no schema, mas o fluxo real de CRUD/emissao ainda usa `ModeloCertificado` e `CertificadoEmitido`. A limpeza feita nesta fase removeu o legado do `layoutConfig`, nao migrou as relacoes academicas para V2.

---

# 2. Arquivos principais

| Arquivo | Responsabilidade |
|---|---|
| `src/certificados/certificados.controller.ts` | Rotas administrativas de modelos, emissao, cancelamento e reemissao |
| `src/certificados/certificados-publico.controller.ts` | Validacao publica por codigo |
| `src/certificados/certificados.service.ts` | Regras de negocio, emissao, historico/auditoria e validacao |
| `src/certificados/pdf.service.ts` | Motor de PDF com `pdf-lib`, fontes, QR Code e renderizacao de layout |
| `src/certificados/image-processing.service.ts` | Processamento de imagens usadas no PDF |
| `src/certificados/dto/*` | DTOs de CRUD, emissao, cancelamento e honraria |

---

# 3. Tipos de certificado

| Tipo | Destinatario | Fluxo |
|---|---|---|
| `ACADEMICO` | Alunos cadastrados em turmas | Automatico pela turma concluida ou manual por aluno/turma |
| `HONRARIA` | Apoiadores cadastrados | Manual por apoiador com titulo da acao e data do evento |

---

# 4. Endpoints administrativos

Base: `/api/modelos-certificados`

| Metodo | Rota | Roles | Descricao | Swagger |
|---|---|---|---|---|
| `POST` | `/` | `ADMIN`, `SECRETARIA` | Cria modelo com `multipart/form-data` (`arteBase`, `assinatura`, `assinatura2`) | Sim |
| `GET` | `/` | `ADMIN`, `SECRETARIA`, `PROFESSOR`, `COMUNICACAO` | Lista modelos de certificados | Sim |
| `GET` | `/:id` | `ADMIN`, `SECRETARIA`, `PROFESSOR`, `COMUNICACAO` | Busca modelo por ID | Sim |
| `PATCH` | `/:id` | `ADMIN`, `SECRETARIA` | Atualiza texto, layout e/ou imagens do modelo | Sim |
| `DELETE` | `/:id` | `ADMIN`, `SECRETARIA` | Remove modelo e arquivos relacionados | Sim |
| `POST` | `/emitir-academico` | `ADMIN`, `SECRETARIA`, `PROFESSOR` | Emite ou recupera certificado academico de aluno/turma | Sim |
| `POST` | `/emitir-manual-academico` | `ADMIN`, `SECRETARIA` | Emite certificado academico manual para aluno e turma cadastrados | Sim |
| `POST` | `/emitir-honraria` | `ADMIN`, `SECRETARIA` | Emite PDF de honraria para apoiador cadastrado | Sim |
| `PATCH` | `/certificados/:id/cancelar` | `ADMIN`, `SECRETARIA` | Cancela certificado valido e invalida consulta publica | Sim |
| `POST` | `/certificados/:id/reemitir` | `ADMIN`, `SECRETARIA` | Cria nova versao academica e marca a anterior como `REISSUED` | Sim |

O controller contem `@ApiOperation` nas rotas e, nas rotas novas de ciclo de vida, `@ApiResponse` e `@ApiParam` quando aplicavel.

---

# 5. Endpoint publico

Base: `/api/certificados`

| Metodo | Rota | Auth | Descricao | Swagger |
|---|---|---|---|---|
| `GET` | `/validar/:codigo` | Publico | Valida autenticidade/status pelo codigo unico | Sim |

O QR Code gerado pelo PDF aponta para o frontend publico:

```text
{FRONTEND_URL}/validar-certificado?codigo={codigoValidacao}
```

---

# 6. Uploads e seguranca

Uploads de modelos usam `FileFieldsInterceptor` com `memoryStorage`.

Campos aceitos:

- `arteBase` obrigatorio na criacao.
- `assinatura` obrigatorio na criacao.
- `assinatura2` opcional.

Formatos aceitos:

- `image/jpeg`
- `image/png`
- `image/webp`

Limite:

- 10 MB por arquivo.

As imagens e PDFs sao enviados para o storage pelo `UploadService`.

---

# 7. Layout do certificado

## 7.1 Estrutura oficial com elements

`ModeloCertificado.layoutConfig` deve conter somente `elements`.

```ts
{
  elements: CertificadoLayoutElement[]
}
```

Tipos suportados:

- `TEXT`
- `DYNAMIC_TEXT`
- `SIGNATURE_IMAGE`
- `SIGNATURE_BLOCK`
- `QR_CODE`
- `VALIDATION_CODE`
- `LINE`

Campos validados:

- `id`, `type`, `label`
- `x`, `y`, `width`, `height`
- `fontFamily`, `fontSize`, `fontWeight`
- `color`, `textAlign`, `lineHeight`
- `zIndex`, `visible`, `content`

As coordenadas sao percentuais em relacao ao tamanho do template.

Campos removidos do contrato de layout:

- `textoPronto`
- `nomeAluno`
- `assinatura1`
- `assinatura2`
- `qrCode`
- `legacyField`

---

# 8. Variaveis de template

O backend substitui variaveis nos textos e elementos dinamicos. Principais aliases:

## Academico

- `{{ALUNO}}`
- `{{NOME_ALUNO}}`
- `{{TURMA}}`
- `{{CURSO}}`
- `{{NOME_CURSO}}`
- `{{OFICINA}}`
- `{{CARGA_HORARIA}}`
- `{{CH}}`
- `{{DATA_INICIO}}`
- `{{DATA_FIM}}`
- `{{DATA_EMISSAO}}`
- `{{CODIGO_CERTIFICADO}}`
- `{{CODIGO_VALIDACAO}}`
- `{{NOME_INSTITUICAO}}`
- `{{NOME_RESPONSAVEL}}`
- `{{CARGO_RESPONSAVEL}}`

## Honraria/apoiador

- `{{PARCEIRO}}`
- `{{APOIADOR}}`
- `{{NOME_APOIADOR}}`
- `{{NOME_ALUNO}}`
- `{{TITULO_ACAO}}`
- `{{MOTIVO}}`
- `{{DATA_EVENTO}}`
- `{{DATA}}`
- `{{DATA_EMISSAO}}`
- `{{CODIGO_CERTIFICADO}}`
- `{{CODIGO_VALIDACAO}}`

Para honrarias manuais, o DTO novo usa `dataEvento`. O campo `dataEmissao` e mantido apenas como legado de entrada.

---

# 9. Fontes

O PDF suporta fontes padrao e fontes customizadas.

Fontes padrao:

- `Helvetica`
- `TimesRoman`
- `Courier`

Fontes customizadas:

- `Roboto`
- `Open Sans`
- `Montserrat`
- `Merriweather`
- `Cinzel`
- `Playfair Display`
- `Great Vibes`
- `Parisienne`
- `Dancing Script`
- `Pacifico`

As fontes customizadas sao carregadas de URLs fixas do catalogo Google Fonts no GitHub e armazenadas em cache. O diretorio pode ser configurado por:

```text
CERTIFICADOS_FONT_CACHE_DIR
```

O renderizador dinamico sempre preserva `fontFamily`. `fontWeight: bold` nao troca mais a fonte por `HelveticaBold`; por enquanto ele nao carrega uma variante bold real da fonte customizada.

---

# 10. Geracao de PDF

O `PdfService`:

1. Cria o PDF com `pdf-lib`.
2. Registra `fontkit` para fontes customizadas.
3. Embute a arte base.
4. Renderiza exclusivamente `layoutConfig.elements`.
5. Gera QR Code com `qrcode`.
6. Desenha assinaturas, textos, linhas e codigo de validacao.
7. Retorna buffer para upload ou resposta `application/pdf`.

Quando `elements` existe, o PDF renderiza:

- Texto fixo e dinamico.
- Codigo de validacao.
- QR Code.
- Bloco de assinatura.
- Imagem de assinatura.
- Linha decorativa.

---

# 11. Emissao academica

## Automatica por turma/aluno

`POST /api/modelos-certificados/emitir-academico`

Regras:

- Turma deve estar concluida quando aplicavel ao fluxo.
- Aluno deve estar matriculado/concluido.
- Frequencia minima e validada no fluxo academico.
- Se ja existir certificado valido com PDF, o sistema pode reaproveitar.

## Manual academico

`POST /api/modelos-certificados/emitir-manual-academico`

Regras:

- Recebe `modeloId`, `alunoId`, `turmaId` e `dataEmissao` opcional.
- Usa aluno e turma cadastrados.
- Cria ou completa historico de matricula para que o certificado apareca no perfil do aluno.
- Gera `CertificadoEmitido` vinculado a aluno, turma e modelo.

---

# 12. Honraria manual

`POST /api/modelos-certificados/emitir-honraria`

Regras:

- Recebe `modeloId`, `apoiadorId`, `tituloAcao`, `motivo` opcional e `dataEvento`.
- Busca o apoiador cadastrado e ativo.
- Cria `AcaoApoiador` vinculada ao apoiador.
- Gera `CertificadoEmitido` com `status: VALID`, `apoiadorId`, `acaoId`, `nomeImpresso`, `cursoImpresso` e `dadosManuais`.
- Retorna PDF inline e o header `X-Codigo-Validacao`.

---

# 13. Ciclo de vida

`CertificadoEmitido` foi reforcado com:

- `status`
- `version`
- `previousCertificadoId`
- `nomeImpresso`
- `cursoImpresso`
- `cargaHorariaImpresso`
- `dadosManuais`
- `canceledAt`
- `canceledBy`
- `cancelReason`

Status usados:

- `VALID`
- `CANCELED`
- `REISSUED`
- `EXPIRED`
- `DRAFT`

Cancelamento:

- So certificado `VALID` pode ser cancelado.
- A validacao publica passa a retornar invalido.

Reemissao:

- Disponivel para certificados academicos vinculados a aluno/turma.
- Cria nova versao `VALID`.
- Marca a anterior como `REISSUED`.

---

# 14. Auditoria

O modulo usa `AuditLogService` manualmente em eventos sensiveis:

- Criacao/atualizacao/remocao de modelo.
- Emissao de certificado.
- Criacao de matricula historica por emissao manual.
- Cancelamento.
- Reemissao.

---

# 15. Testes e validacao tecnica

Testes relevantes:

```bash
npm run build
npm test -- certificados.service.spec.ts certificados.controller.spec.ts pdf.service.spec.ts --runInBand
```

Fluxos manuais recomendados:

1. Criar modelo academico com arte e assinatura.
2. Editar layout com `elements`.
3. Testar fontes `Great Vibes`, `Parisienne`, `Dancing Script`, `Pacifico`, `Cinzel`.
4. Emitir certificado academico automatico.
5. Emitir certificado academico manual.
6. Emitir honraria manual para apoiador.
7. Validar QR Code publicamente.
8. Cancelar certificado e confirmar status invalido.
9. Reemitir certificado academico e conferir versoes.

---

# 16. Decisoes e proximos passos

## Mantido por enquanto

- `ModeloCertificado`
- `CertificadoEmitido`
- Relacoes academicas atuais, como `Turma.modeloCertificadoId`
- Fluxos de emissao academica, manual e honraria baseados no service atual

## Caminho recomendado

1. Validar criacao/edicao de modelos novos apenas com `layoutConfig.elements`.
2. Testar PDF academico e honraria com layouts por elementos.
3. Decidir entre evoluir `ModeloCertificado`/`CertificadoEmitido` ou migrar de fato para as tabelas V2.
4. Migrar relacoes academicas apenas em uma fase propria.

**Criticidade:** Importante  
**Complexidade:** Alta  
**Status:** Layout consolidado em `elements`; banco funcional ainda usa `ModeloCertificado` e `CertificadoEmitido`
