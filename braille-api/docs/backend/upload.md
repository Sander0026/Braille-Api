# Modulo: Upload

---

# 1. Visao Geral

## Objetivo

Documentar `src/upload`, modulo de upload e exclusao de arquivos no Cloudinary.

## Responsabilidade

Receber arquivos via Multer em memoria, validar tipo, enviar imagens/PDFs para pastas Cloudinary, gerar URLs, deletar arquivos e auditar operacoes quando houver contexto de usuario.

## Fluxo de Funcionamento

O controller aplica `AuthGuard`, intercepta arquivo com `FileInterceptor` e chama `UploadService`. Imagens sao otimizadas por Cloudinary; PDFs usam `resource_type:auto` ou `raw` quando gerados em buffer. A exclusao deriva `publicId` da URL.

---

# 2. Arquitetura e Metodologias

## Padroes Arquiteturais Identificados

* Adapter Service para Cloudinary.
* Streaming Upload.
* DTO-less multipart endpoint.
* Audit Trail.
* Role-based deletion.

## Justificativa Tecnica

Centralizar Cloudinary evita duplicacao de configuracao e regras de validacao. Streaming via `streamifier` reduz necessidade de arquivo temporario em disco. A auditoria em upload/delete cria rastreabilidade de assets sensiveis.

---

# 3. Fluxo Interno do Codigo

## Fluxo de Execucao

1. Controller recebe arquivo em memoria.
2. `uploadImage` valida mime: JPEG, PNG, JPG, WebP ou PDF.
3. Imagem vai para pasta `braille_instituicao` com transformacao `fetch_format:auto` e `quality:auto`.
4. PDF em `uploadImage` usa `resource_type:auto`.
5. `uploadPdf` aceita imagem ou PDF e pasta especifica: `braille_lgpd`, `braille_atestados`, `braille_laudos`.
6. `uploadPdfBuffer` envia buffer de certificado como `raw`, com `public_id` deterministico.
7. `deleteFile` extrai pasta e filename da URL, detecta tipo por `.pdf` e chama `cloudinary.uploader.destroy`.
8. Auditoria registra operacoes Cloudinary quando `auditUser` existe.

## Dependencias Internas

* `AuditLogService`
* `getAuditUser`
* `AuthGuard`, `RolesGuard`, `Roles`

## Dependencias Externas

* `cloudinary`
* `streamifier`
* `multer`
* `@nestjs/platform-express`
* `@nestjs/config`

---

# 4. Dicionario Tecnico

## Variaveis

* `cloud_name`, `api_key`, `api_secret`: credenciais Cloudinary.
* `allowedMimes`: tipos aceitos para upload geral.
* `folder`: pasta Cloudinary.
* `resource_type`: `image`, `auto` ou `raw`.
* `public_id`: identificador remoto.
* `secure_url`: URL final retornada.

## Funcoes e Metodos

* `uploadImage(file,auditUser)`: envia imagem/PDF geral.
* `uploadPdf(file,folder,auditUser)`: envia documento LGPD/atestado/laudo.
* `uploadPdfBuffer(buffer,fileName,folder)`: envia PDF gerado em memoria.
* `deleteFile(fileUrl,auditUser)`: remove arquivo remoto.

## Classes

* `UploadController`
* `UploadService`
* `UploadModule`

## Interfaces e Tipagens

* `Express.Multer.File`
* `AuditUser`
* `AuditAcao`
* `Role`

---

# 5. Servicos e Integracoes

## APIs

* `POST /api/upload`: upload autenticado de imagem/PDF geral.
* `POST /api/upload/pdf`: upload autenticado de PDF/imagem documental com pasta.
* `DELETE /api/upload?url=`: exclusao restrita a `ADMIN` e `SECRETARIA`.

## Banco de Dados

Nao persiste diretamente, mas registra auditoria em `AuditLog`.

## Servicos Externos

Cloudinary.

---

# 6. Seguranca e Qualidade

## Seguranca

* Upload exige usuario autenticado.
* Delete exige roles altas.
* Tipo MIME e validado.
* Tamanho grande recebe mensagem amigavel.
* Auditoria registra URL/pasta/publicId.

## Qualidade

* Configuracao Cloudinary fica no construtor.
* Erros remotos sao normalizados.
* Certificados usam public ID deterministico para evitar arquivos orfaos.

## Performance

* Streaming evita gravar arquivo em disco.
* Cloudinary otimiza imagens automaticamente.

---

# 7. Regras de Negocio

* Apenas imagens e PDFs sao aceitos.
* Documentos sao separados por pastas funcionais.
* PDFs gerados em memoria ficam em `braille_certificados` por padrao.
* Exclusao considera resultado `ok` e `not found` como sucesso operacional.

---

# 8. Pontos de Atencao

* `deleteFile` infere `resource_type` por extensao `.pdf`; PDFs enviados como `auto` podem ter comportamento diferente conforme Cloudinary.
* `publicId` derivado por split simples pode falhar em URLs com transformacoes complexas.
* Nao ha validacao de tamanho antes do stream; depende da rejeicao Cloudinary/Multer.

---

# 9. Relacao com Outros Modulos

* Usado por `Auth`, `Users`, `Beneficiaries`, `Comunicados`, `Atestados`, `Laudos`, `Apoiadores` e `Certificados`.
* `AuditLog` recebe rastros de operacoes.

---

# 10. Resumo Tecnico Final

Upload e modulo transversal de criticidade alta por manipular documentos e imagens externas. A complexidade e media. O maior risco tecnico esta na robustez da extracao de `publicId` e no alinhamento de `resource_type` entre upload e delete.

