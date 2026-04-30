# Modulo: Apoiadores

---

# 1. Visao Geral

## Objetivo

Documentar `src/apoiadores`, modulo de CRM institucional, acoes de apoiadores e certificados de honraria.

## Responsabilidade

Cadastrar apoiadores, listar publicamente apoiadores exibiveis, manter dados de contato/endereco/segmentacao, registrar acoes/eventos, emitir certificados vinculados a apoiadores e disponibilizar PDF de certificado.

## Fluxo de Funcionamento

Rotas administrativas usam `AuthGuard` e `RolesGuard`; endpoint publico lista apenas apoiadores ativos e marcados para exibicao. O service grava apoiador, acoes e certificados, usando `PdfService` e `UploadService` para gerar/cachear PDF.

---

# 2. Arquitetura e Metodologias

## Padroes Arquiteturais Identificados

* CRM CRUD.
* Public Projection.
* Audit Trail.
* Certificate Rendering.
* Cache-aside para PDF.
* Transaction Script em remocao de acao.

## Justificativa Tecnica

Apoiadores misturam dados publicos e PII. Separar `PUBLIC_SELECT` de `LIST_SELECT` reduz vazamento em endpoint publico. Certificados vinculados a acoes criam rastreabilidade institucional de parcerias.

---

# 3. Fluxo Interno do Codigo

## Fluxo de Execucao

1. `create` separa acoes aninhadas e cria apoiador com acoes opcionais.
2. `findAll` aplica filtros `tipo`, `search`, `ativo`, paginacao e select operacional.
3. `findPublic` retorna somente ativos/exibiveis com campos nao sensiveis.
4. `updateLogo` atualiza apenas URL de logo.
5. `inativar` marca `ativo=false` e `exibirNoSite=false`.
6. `reativar` restaura ambos para true.
7. `addAcao` cria evento e pode emitir certificado automatico se modelo for informado.
8. `updateAcao` retifica evento e reemite certificados apos deletar anteriores.
9. `removeAcao` deleta certificados da acao e a acao em transacao.
10. `emitirCertificado` preenche template, gera PDF, tenta upload e cria `CertificadoEmitido`.
11. `gerarPdfCertificado` valida cache, gera PDF se necessario, armazena e retorna URL allowlisted.

## Dependencias Internas

* `PrismaService`
* `PdfService`
* `UploadService`
* `AuditLogService`
* `formatarDataBR`
* `preencherTemplateTexto`

## Dependencias Externas

* `node:crypto`
* `@prisma/client`
* Multer via controller para logo.

---

# 4. Dicionario Tecnico

## Variaveis

* `PUBLIC_SELECT`: campos seguros ao site.
* `LIST_SELECT`: campos de administracao.
* `REDIRECT_ALLOWLIST`: hosts permitidos para PDF.
* `tipo`: enum `TipoApoiador`.
* `nomeRazaoSocial`, `nomeFantasia`: identificacao.
* `cpfCnpj`, `email`, `telefone`: PII operacional.
* `exibirNoSite`: visibilidade publica.
* `descricaoAcao`: descricao do evento.
* `motivoPersonalizado`: texto de certificado.

## Funcoes e Metodos

* `create(dto,auditUser)`: cria apoiador.
* `findAll(params)`: lista admin.
* `findPublic()`: lista publica sem PII.
* `findOne(id)`: busca completa.
* `update`, `updateLogo`, `inativar`, `reativar`: manutencao.
* `addAcao`, `updateAcao`, `getAcoes`, `removeAcao`: historico.
* `emitirCertificado(apoiadorId,dto,auditUser)`: gera certificado.
* `getCertificados(apoiadorId)`: lista certificados.
* `gerarPdfCertificado(apoiadorId,certId)`: cache/gera PDF.
* `validarUrlRedirect(url)`: allowlist anti SSRF.
* `dispararAuditoria(params)`: auditoria fire-and-forget.

## Classes

* `ApoiadoresController`
* `ApoiadoresService`
* `CreateApoiadorDto`, `UpdateApoiadorDto`
* `CreateAcaoApoiadorDto`, `UpdateAcaoApoiadorDto`
* `EmitirCertificadoApoiadorDto`

## Interfaces e Tipagens

* `TipoApoiador`
* `Apoiador`
* `AcaoApoiador`
* `CertificadoEmitido`

---

# 5. Servicos e Integracoes

## APIs

* `POST /api/apoiadores`
* `GET /api/apoiadores`
* `GET /api/apoiadores/publicos`
* `GET /api/apoiadores/:id`
* `PATCH /api/apoiadores/:id`
* `PATCH /api/apoiadores/:id/logo`
* `PATCH /api/apoiadores/:id/inativar`
* `PATCH /api/apoiadores/:id/reativar`
* `POST /api/apoiadores/:id/acoes`
* `PATCH /api/apoiadores/:id/acoes/:acaoId`
* `GET /api/apoiadores/:id/acoes`
* `DELETE /api/apoiadores/:id/acoes/:acaoId`
* `POST /api/apoiadores/:id/certificados`
* `GET /api/apoiadores/:id/certificados`
* `GET /api/apoiadores/:id/certificados/:certId/pdf`

## Banco de Dados

Entidades `Apoiador`, `AcaoApoiador`, `ModeloCertificado`, `CertificadoEmitido`.

## Servicos Externos

Cloudinary via `UploadService`; PDF via `PdfService`.

---

# 6. Seguranca e Qualidade

## Seguranca

* Endpoint publico exclui CPF/CNPJ, email, telefone, observacoes e contato.
* Redirect de PDF valida host.
* Mutacoes exigem roles de gestao.
* Reativacao restrita a `ADMIN`.

## Qualidade

* Auditoria em todas as mutacoes relevantes.
* Transacao ao remover acao e certificados relacionados.
* Cache de PDF evita regeracao constante.

## Performance

* `findAll` usa `Promise.all`.
* `gerarPdfCertificado` reaproveita `pdfUrl`.
* Selects reduzem campos pesados em listagens.

---

# 7. Regras de Negocio

* Apoiador inativo nao deve aparecer no site.
* Acoes podem gerar certificado automaticamente.
* Atualizar acao com modelo apaga certificados anteriores da acao e reemite.
* PDF de certificado e cacheado apos primeira geracao.

---

# 8. Pontos de Atencao Tratados

* O retorno do `pdfBase64` no `emitirCertificado` agora é opcional (controlado via query param `incluirPdfBase64=true`), evitando sobrecarga no payload da resposta.
* A criação do registro do certificado no banco agora só ocorre após o upload bem-sucedido do PDF (`pdfUrl`), garantindo que não existam certificados sem arquivo.
* A reativação de um apoiador (`reativar`) agora define `exibirNoSite=false` por padrão, forçando uma revisão antes da publicação no site.

---

# 9. Relacao com Outros Modulos

* Usa `Certificados/PdfService`.
* Usa `Upload` para logos e PDFs.
* Usa `AuditLog`.
* Compartilha `CertificadoEmitido` com validacao publica e modelos.

---

# 10. Resumo Tecnico Final

Apoiadores é um módulo de criticidade média-alta por combinar CRM, dados públicos/privados e certificados. A complexidade é média-alta. As principais recomendações de segurança (prevenção de certificados órfãos de URL, payload controlável e reativação com visibilidade padrão fechada) já se encontram implementadas e garantem a robustez e integridade da funcionalidade.

