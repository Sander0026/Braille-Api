# 54 — Upload: Visão Geral do Módulo (`src/upload/`)

---

# 1. Visão Geral

O módulo `Upload` é responsável pelo envio e exclusão de arquivos no Cloudinary, servindo como infraestrutura de arquivos para conteúdo institucional, documentos LGPD, laudos, atestados e certificados.

Arquivos principais:

```txt
src/upload/upload.module.ts
src/upload/upload.controller.ts
src/upload/upload.service.ts
```

Responsabilidades principais:

- receber uploads multipart/form-data;
- validar tipo MIME;
- validar tamanho máximo;
- enviar imagens e PDFs para o Cloudinary;
- separar arquivos por pastas funcionais;
- otimizar imagens via Cloudinary;
- enviar PDFs gerados em memória;
- excluir arquivos por URL;
- restringir exclusão a pastas permitidas;
- auditar upload e exclusão em `Cloudinary_System`;
- exportar `UploadService` para uso por outros módulos.

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- NestJS Module Pattern;
- Controller-Service Pattern;
- File Upload Pattern;
- Cloudinary Integration Pattern;
- Memory Storage Pattern;
- Stream Upload Pattern;
- Folder Whitelist Pattern;
- Manual Audit Pattern;
- Best-effort Audit Pattern;
- Defensive File Validation Pattern.

## Justificativa Técnica

O módulo separa upload físico de arquivos das entidades de negócio.

Exemplo:

```txt
UploadModule envia arquivo ao Cloudinary
Beneficiaries/Atestados/Certificados armazenam a URL retornada
```

Essa separação reduz acoplamento e evita armazenar binários no banco de dados.

---

# 3. UploadModule

Importa:

- `AuditLogModule`.

Declara:

- `UploadController`;
- `UploadService`.

Exporta:

- `UploadService`.

A exportação permite uso em módulos como:

- `BeneficiariesModule`;
- `AtestadosModule`;
- `CertificadosModule`.

---

# 4. UploadController

Base route:

```txt
/upload
```

Decorators:

```txt
@ApiTags('Uploads de Arquivos')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@SkipAudit()
@Controller('upload')
```

Todas as rotas exigem autenticação.

## Rotas

| Método | Rota | Perfis | Responsabilidade |
|---|---|---|---|
| `POST` | `/upload` | ADMIN/COMUNICACAO | Upload institucional de imagem/PDF |
| `DELETE` | `/upload?url=` | ADMIN/SECRETARIA/COMUNICACAO | Excluir arquivo por URL |
| `POST` | `/upload/pdf?tipo=` | ADMIN/SECRETARIA | Upload de PDF/imagem documental |

---

# 5. Tipos de Upload

## Upload Institucional

Endpoint:

```txt
POST /upload
```

Aceita:

- imagens;
- PDF.

Pasta destino:

```txt
braille_instituicao
```

Perfis:

```txt
ADMIN
COMUNICACAO
```

## Upload Documental

Endpoint:

```txt
POST /upload/pdf?tipo=lgpd|atestado|laudo
```

Aceita:

- PDF;
- imagens.

Mapeamento de pastas:

| tipo | Pasta Cloudinary |
|---|---|
| `lgpd` | `braille_lgpd` |
| `atestado` | `braille_atestados` |
| `laudo` | `braille_laudos` |

Perfis:

```txt
ADMIN
SECRETARIA
```

## Upload de PDF em Buffer

Método de service:

```txt
uploadPdfBuffer(buffer, fileName, folder = 'braille_certificados')
```

Uso esperado:

- certificados gerados dinamicamente;
- PDFs em memória sem Multer.

Pasta padrão:

```txt
braille_certificados
```

---

# 6. Validações de Arquivo

## Tamanho máximo

```txt
10 MB
```

Constante:

```txt
cloudinaryMaxFileSize = 10 * 1024 * 1024
```

A validação ocorre:

- no interceptor Multer;
- no service antes do upload;
- no upload de buffer.

## Tipos aceitos

Imagens:

- `image/jpeg`;
- `image/png`;
- `image/jpg`;
- `image/webp`.

PDF:

- `application/pdf`.

## Mensagens públicas

O service converte erros de tamanho do Cloudinary para mensagens amigáveis como:

```txt
Arquivo muito grande. O tamanho máximo é 10 MB.
PDF muito grande. O tamanho máximo é 10 MB. Comprima o PDF e tente novamente.
```

---

# 7. UploadService

Métodos principais:

| Método | Responsabilidade |
|---|---|
| `uploadImage()` | Upload institucional de imagem/PDF |
| `uploadPdf()` | Upload documental de PDF/imagem |
| `uploadPdfBuffer()` | Upload de PDF gerado em memória |
| `deleteFile()` | Excluir arquivo do Cloudinary |
| `validarTamanhoArquivo()` | Validar tamanho bruto |
| `validarTamanhoMulter()` | Validar tamanho vindo do Multer |
| `extrairPublicIdsCloudinary()` | Extrair public_id com/sem extensão |
| `validarPastaCloudinary()` | Garantir que delete só ocorra em pastas permitidas |
| `extrairPublicIdDeUrl()` | Extrair public_id de URL Cloudinary |
| `tiposDeletePorArquivo()` | Determinar resource_type para exclusão |

---

# 8. Pastas Permitidas

Lista controlada no service:

```txt
braille_instituicao
braille_lgpd
braille_atestados
braille_laudos
braille_certificados
```

A exclusão valida se o `public_id` pertence a uma dessas pastas.

Isso reduz o risco de excluir arquivos externos à aplicação.

---

# 9. Integração com Cloudinary

Configuração carregada por `ConfigService`:

```txt
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

O upload usa:

```txt
cloudinary.uploader.upload_stream()
```

O buffer é convertido em stream com:

```txt
streamifier.createReadStream(file.buffer).pipe(uploadStream)
```

## Imagens

Usam transformação:

```txt
fetch_format: auto
quality: auto
```

## PDFs

Usam `resource_type: auto` ou `raw`, dependendo do fluxo.

Certificados em buffer usam `resource_type: raw` e preservam extensão `.pdf`.

---

# 10. Exclusão de Arquivos

Endpoint:

```txt
DELETE /upload?url=...
```

Fluxo:

1. valida presença da URL;
2. extrai public_id da URL ou do valor bruto;
3. cria variações com e sem extensão;
4. valida se public_id está em pasta permitida;
5. tenta deletar como `image` e/ou `raw`;
6. audita exclusão se houver `auditUser`;
7. retorna sucesso.

A estratégia tenta lidar com diferenças entre recursos `image` e `raw`, especialmente PDFs.

---

# 11. Auditoria

Entidade auditada:

```txt
Cloudinary_System
```

Ações:

- `CRIAR` em upload;
- `EXCLUIR` em delete.

A auditoria registra:

- public_id;
- URL;
- pasta;
- autor;
- IP;
- user agent.

Falhas de auditoria são registradas como warning e não bloqueiam upload/delete.

---

# 12. Segurança e Qualidade

## Segurança

Pontos fortes:

- todas as rotas exigem JWT;
- upload institucional restrito a ADMIN/COMUNICACAO;
- upload documental restrito a ADMIN/SECRETARIA;
- delete restrito a ADMIN/SECRETARIA/COMUNICACAO;
- tamanho máximo de 10 MB;
- MIME validado no controller e no service;
- exclusão limitada a pastas permitidas;
- URL Cloudinary inválida gera erro;
- auditoria registra ações no Cloudinary.

## Qualidade

Pontos positivos:

- service exportável para outros módulos;
- upload via stream;
- tratamento amigável de erro de tamanho;
- separação por pastas funcionais;
- suporte a PDF em buffer;
- delete robusto para `image` e `raw`.

## Performance

- usa `memoryStorage`, adequado para limite de 10 MB;
- upload via stream reduz complexidade;
- Cloudinary otimiza imagens automaticamente;
- validação local evita chamada externa desnecessária em arquivos grandes/tipos inválidos.

---

# 13. Pontos de Atenção

## Riscos

- `memoryStorage` mantém o arquivo em RAM; limite de 10 MB precisa ser preservado.
- MIME type pode ser falsificado; validação por assinatura real seria mais robusta.
- `deleteFile()` aceita URL ou public_id bruto, exigindo cuidado com validação de pasta.
- Auditoria não bloqueante pode falhar sem impedir operação.
- Upload institucional aceita PDF, apesar do nome `uploadImage()`.

## Débitos Técnicos

- Validar assinatura real do arquivo.
- Padronizar nomes de métodos, separando imagem/PDF.
- Criar DTO para query `tipo` e `url`.
- Criar testes de delete por URL Cloudinary e public_id.
- Criar testes para bloqueio de pasta não permitida.

---

# 14. Melhorias Futuras

- Validação por magic bytes;
- antivírus/scan para documentos;
- fila para deleção com retry;
- armazenamento de metadados de arquivo no banco;
- assinatura temporária para upload direto no frontend;
- CDN/cache policy documentada;
- limite por tipo de arquivo;
- logs estruturados de upload/delete.

---

# 15. Resumo Técnico Final

O módulo `Upload` é a infraestrutura central de arquivos da API.

Ele integra com Cloudinary, valida tipos/tamanho, separa pastas, audita operações e fornece serviços reutilizáveis para beneficiários, atestados e certificados.

Criticidade: muito alta.

Complexidade: alta.

A implementação é robusta e profissional. Os principais próximos passos são validação por assinatura real, testes de exclusão segura, padronização de métodos e armazenamento de metadados dos arquivos.
