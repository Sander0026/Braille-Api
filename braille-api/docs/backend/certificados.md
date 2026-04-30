# Modulo: Certificados

---

# 1. Visao Geral

## Objetivo

Documentar `src/certificados`, incluindo modelos, emissao academica, honrarias, validacao publica, processamento de assinatura e motor PDF.

## Responsabilidade

Criar e manter modelos de certificado, processar arquivos de arte/assinatura, gerar PDFs com QR Code, armazenar certificados no Cloudinary, emitir certificados academicos e de honraria, regenerar certificados quando nome do aluno muda e validar publicamente codigos.

## Fluxo de Funcionamento

Modelos recebem arte base e assinaturas. Assinaturas podem ter fundo branco removido. Emissao academica valida turma, matricula, conclusao, modelo e frequencia minima. O PDF e gerado por `PdfService`, enviado ao Cloudinary e registrado em `CertificadoEmitido`. A validacao publica busca por `codigoValidacao`.

---

# 2. Arquitetura e Metodologias

## Padroes Arquiteturais Identificados

* Service Layer.
* Template Rendering.
* Cache-aside por certificado ja emitido.
* Adapter Pattern para PDF/Cloudinary.
* Allowlist Security.
* Background Regeneration.

## Justificativa Tecnica

Certificados combinam regra academica, identidade visual e validade publica. Usar modelo persistido permite personalizacao. Cachear `pdfUrl` evita recomputar PDF. Public ID deterministico permite sobrescrever documentos quando dados do aluno mudam.

---

# 3. Fluxo Interno do Codigo

## Fluxo de Execucao

1. `create` faz upload paralelo de arte base e assinaturas.
2. Assinaturas passam por `ImageProcessingService.removerFundoBrancoAssinatura`.
3. `layoutConfig` e parseado de JSON.
4. Modelo e criado em `ModeloCertificado`.
5. `emitirAcademico` busca turma com modelo e matricula do aluno.
6. Verifica turma/matricula concluida.
7. Verifica frequencia minima de 75% quando ha registros.
8. Reaproveita certificado existente com `pdfUrl`.
9. Preenche tags `ALUNO`, `TURMA`, `CARGA_HORARIA`, `DATA_INICIO`, `DATA_FIM`.
10. `PdfService` baixa arte e assinaturas de hosts allowlist, desenha texto, nome, assinaturas e QR Code.
11. PDF vai ao Cloudinary como raw.
12. Registro `CertificadoEmitido` e criado/atualizado.
13. `validarPublico` valida formato do codigo e retorna dados nao sensiveis.

## Dependencias Internas

* `PrismaService`
* `UploadService`
* `PdfService`
* `ImageProcessingService`
* `AuditLogService`
* DTOs de certificado

## Dependencias Externas

* `pdf-lib`
* `@pdf-lib/fontkit`
* `qrcode`
* `jimp`
* `node:crypto`
* `fetch`

---

# 4. Dicionario Tecnico

## Variaveis

* `arteBaseUrl`: imagem de fundo.
* `assinaturaUrl`, `assinaturaUrl2`: imagens de assinatura.
* `textoTemplate`: template com tags.
* `layoutConfig`: JSON com coordenadas e estilos.
* `codigoValidacao`: codigo publico unico.
* `pdfUrl`: URL Cloudinary.
* `FONTS_URLS`: catalogo de fontes permitidas.
* `ALLOWED_IMAGE_HOSTS`, `ALLOWED_FONT_HOSTS`: allowlists anti SSRF.
* `fontCache`: cache de fontes baixadas.
* `frontendUrl`: base do link QR Code.

## Funcoes e Metodos

* `uploadAssinatura(file)`: remove fundo e envia PNG.
* `trocarArquivo(urlAtual,novoFile,ehAssinatura,label)`: substitui asset.
* `substituirTags(template,vars)`: renderiza texto academico.
* `verificarFrequencia(turmaId,alunoId)`: exige 75%.
* `parseLayoutConfig(raw,contexto)`: parse seguro de JSON.
* `create`, `findAll`, `findOne`, `update`, `remove`: CRUD de modelo.
* `emitirAcademico(dto,auditUser)`: emite certificado de aluno.
* `emitirHonraria(dto,auditUser)`: emite honraria.
* `regenerarCertificadosAluno(alunoId)`: recria PDFs existentes.
* `validarPublico(codigo)`: valida certificado.
* `PdfService.construirPdfBase(modelo,texto,codigo,nomeAluno)`: engine de PDF.
* `sanitizeSafeUrl`: bloqueia hosts nao autorizados.

## Classes

* `CertificadosController`
* `CertificadosPublicoController`
* `CertificadosService`
* `PdfService`
* `ImageProcessingService`
* `CreateCertificadoDto`, `UpdateCertificadoDto`
* `EmitirAcademicoDto`, `EmitirHonrariaDto`

## Interfaces e Tipagens

* `ModeloPdf`
* `TipoCertificado`
* `ModeloCertificado`
* `CertificadoEmitido`

---

# 5. Servicos e Integracoes

## APIs

* `GET /api/certificados/validar/:codigo`: publico.
* `GET /api/modelos-certificados/teste`: homologacao geometrica.
* `POST /api/modelos-certificados/emitir-academico`
* `POST /api/modelos-certificados/emitir-honraria`
* `POST /api/modelos-certificados`
* `GET /api/modelos-certificados`
* `GET /api/modelos-certificados/:id`
* `PATCH /api/modelos-certificados/:id`
* `DELETE /api/modelos-certificados/:id`

## Banco de Dados

* `ModeloCertificado`: template visual e textual.
* `CertificadoEmitido`: codigo, PDF, relacoes com aluno/turma/apoiador/acao/modelo.
* `Turma`, `Aluno`, `Frequencia`, `MatriculaOficina` para emissao academica.

## Servicos Externos

* Cloudinary.
* GitHub raw para fontes Google Fonts allowlisted.
* Frontend publico para URL de validacao QR Code.

---

# 6. Seguranca e Qualidade

## Seguranca

* Emissao/CRUD protegidos por roles.
* Validacao publica limita formato e tamanho do codigo.
* `PdfService` aplica allowlist de host para imagens/fontes contra SSRF.
* Dados sensiveis de aluno nao sao selecionados na emissao.
* Redirect de apoiadores tambem valida host.

## Qualidade

* Cache hit evita regenerar PDF.
* Public ID deterministico evita orfaos.
* Falhas de regeneracao individual nao interrompem lote.
* Font cache evita baixar fonte repetidamente.

## Performance

* Uploads de assets em paralelo.
* PDF cacheado por `pdfUrl`.
* `Promise.all` em regeneracao para aluno/certs.

---

# 7. Regras de Negocio

* Certificado academico exige aluno matriculado na turma.
* Turma ou matricula deve estar `CONCLUIDA`.
* Turma precisa ter modelo configurado.
* Frequencia minima e 75% quando existem registros.
* Certificado existente com PDF e retornado sem nova geracao.
* Honraria exige modelo tipo `HONRARIA`.
* Validacao publica nao revela CPF/RG/documentos.

---

# 8. Pontos de Atencao Tratados

* O contrato de `emitirHonraria` foi tipado e padronizado com o retorno `HonrariaPdfResult` contendo o buffer e o código de validação legível para ser tratado adequadamente pelo Controller.
* O método `remove` do CRUD de modelos foi refatorado para utilizar chamadas diretas através de um `Promise.allSettled` para deleção paralela de arquivos antigos no Cloudinary (excluindo redundâncias prévias).
* A resiliência do carregamento de fontes foi consideravelmente melhorada. O `PdfService` agora conta com um cache em memória (`fontCache` de instâncias `ArrayBuffer`) para evitar downloads repetitivos via rede, além de adotar um fallback seguro para a fonte embutida `Helvetica` nativa do PDF em caso de queda de rede externa (evitando falha catastrófica da emissão).

---

# 9. Relacao com Outros Modulos

* Depende de `Upload`, `Beneficiaries`, `Turmas`, `Frequencias`, `Apoiadores`, `AuditLog`.
* `BeneficiariesService` chama regeneracao ao mudar nome.
* `ApoiadoresService` usa `PdfService` para certificados de apoiador.

---

# 10. Resumo Tecnico Final

Certificados é um módulo de alta criticidade e complexidade gráfica. Ele transforma regras acadêmicas e relacionais em um documento público, rastreável e verificável. A arquitetura atual se provou madura: os riscos clássicos de falha na geração do PDF por perda de rede foram sanados com a implementação do cache de memória `fontCache` e do uso das fontes padrão embutidas no PDF como rede de segurança final (`StandardFonts.Helvetica`). A comunicação assíncrona entre o upload visual e a persistência também o mantém muito estável.

