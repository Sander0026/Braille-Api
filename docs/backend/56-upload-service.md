# 56 — UploadService (`src/upload/upload.service.ts`)

---

# 1. Visão Geral

O `UploadService` é o núcleo de integração da API com o Cloudinary.

Ele recebe arquivos validados pelo controller, executa validações adicionais, envia buffers por stream, remove arquivos por URL/public_id e registra auditoria das operações realizadas no armazenamento externo.

Responsabilidades principais:

- configurar SDK do Cloudinary;
- validar tamanho máximo de arquivos;
- validar MIME types permitidos;
- realizar upload institucional de imagem/PDF;
- realizar upload documental de PDF/imagem;
- realizar upload de PDF gerado em memória;
- otimizar imagens via transformação Cloudinary;
- excluir arquivos por URL ou public_id;
- extrair public_id de URL Cloudinary;
- validar pastas permitidas antes de excluir;
- lidar com resource types `image` e `raw`;
- auditar criação e exclusão em `Cloudinary_System`;
- ocultar erros técnicos do Cloudinary do cliente quando necessário.

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- Service Layer;
- External Storage Adapter Pattern;
- Cloudinary Integration Pattern;
- Stream Upload Pattern;
- Defensive Validation Pattern;
- Folder Whitelist Pattern;
- Resource Type Fallback Pattern;
- Manual Audit Pattern;
- Best-effort Audit Pattern;
- Error Translation Pattern.

## Justificativa Técnica

O armazenamento de arquivos fica fora do banco de dados. O backend persiste somente URLs nos módulos de negócio, enquanto o `UploadService` concentra a responsabilidade de comunicação com Cloudinary.

Essa separação reduz acoplamento e evita que módulos como `Beneficiaries`, `Atestados` e `Certificados` conheçam detalhes de upload, public_id, resource type ou transformações Cloudinary.

---

# 3. Dependências

| Dependência | Uso |
|---|---|
| `cloudinary.v2` | SDK oficial para upload/delete |
| `streamifier` | Converter buffer em stream |
| `ConfigService` | Ler credenciais Cloudinary |
| `AuditLogService` | Auditar upload e exclusão |
| `AuditUser` | Identificar autor da operação |

Credenciais usadas:

```txt
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

---

# 4. Configuração e Constantes

A configuração ocorre no construtor:

```txt
cloudinary.config({ cloud_name, api_key, api_secret })
```

Tamanho máximo:

```txt
10 MB
```

Pastas permitidas:

```txt
braille_instituicao
braille_lgpd
braille_atestados
braille_laudos
braille_certificados
```

Essas pastas protegem a exclusão de arquivos fora do escopo da aplicação.

---

# 5. Helpers Privados

## `validarTamanhoArquivo()`

Valida bytes brutos e lança `BadRequestException` se ultrapassar 10 MB.

## `validarTamanhoMulter()`

Calcula o maior valor entre `file.size` e `file.buffer.length`, depois delega para `validarTamanhoArquivo()`.

## `extrairPublicIdsCloudinary()`

Extrai possíveis `public_id` com e sem extensão a partir de URL ou public_id bruto.

## `extrairPublicIdDeUrl()`

Faz parse de URL Cloudinary, localiza o segmento `upload`, ignora versão `v123...` quando existir e retorna o public_id.

## `validarPastaCloudinary()`

Garante que o public_id pertença a uma das pastas permitidas.

## `tiposDeletePorArquivo()`

Define a ordem de tentativa de exclusão entre `image` e `raw`, conforme URL ou extensão.

---

# 6. `uploadImage()`

Apesar do nome, aceita:

- imagens JPG/JPEG;
- PNG;
- WebP;
- PDF.

Pasta destino:

```txt
braille_instituicao
```

Fluxo:

1. valida MIME type;
2. identifica se é PDF;
3. valida tamanho;
4. monta opções de upload;
5. envia buffer com `streamifier` para `cloudinary.uploader.upload_stream()`;
6. audita `CRIAR` em `Cloudinary_System`;
7. retorna `{ url: secure_url }`.

Imagens usam transformação:

```txt
fetch_format: auto
quality: auto
```

---

# 7. `uploadPdf()`

Aceita PDF ou imagem documental.

Pastas aceitas:

```txt
braille_lgpd
braille_atestados
braille_laudos
```

Fluxo:

1. valida se é imagem ou PDF;
2. valida tamanho;
3. monta opções conforme tipo;
4. envia buffer por stream;
5. audita upload;
6. retorna URL segura.

---

# 8. `uploadPdfBuffer()`

Envia PDF gerado em memória, sem Multer.

Uso esperado:

- certificados gerados dinamicamente;
- documentos internos gerados pelo backend.

Pasta padrão:

```txt
braille_certificados
```

Usa:

```txt
resource_type: raw
overwrite: true
public_id com extensão .pdf
```

---

# 9. `deleteFile()`

Exclui arquivo do Cloudinary com segurança.

Fluxo:

1. valida URL;
2. extrai public_ids possíveis;
3. valida pasta permitida;
4. determina ordem de resource types;
5. tenta deletar no Cloudinary;
6. audita `EXCLUIR` se houver usuário;
7. retorna sucesso.

A validação de pasta impede exclusões fora das pastas do sistema.

---

# 10. Auditoria

Entidade auditada:

```txt
Cloudinary_System
```

Ações:

- `CRIAR` em upload;
- `EXCLUIR` em delete.

Auditoria é não bloqueante: falhas viram warning e não impedem upload/delete.

---

# 11. Segurança e Qualidade

## Segurança

- valida MIME type no service;
- valida tamanho no service;
- traduz erro do Cloudinary para mensagem segura;
- restringe exclusão a pastas permitidas;
- tenta excluir com resource type correto;
- audita criação e exclusão;
- não expõe detalhes internos do Cloudinary em delete.

## Qualidade

- métodos especializados por cenário;
- helpers privados coesos;
- upload via stream;
- suporte a PDF buffer para certificados;
- validação duplicada com controller;
- tratamento de PDFs e imagens separado nas opções Cloudinary.

---

# 12. Pontos de Atenção

- `uploadImage()` aceita PDF, apesar do nome indicar imagem.
- MIME type pode ser falsificado; falta validação por assinatura real.
- `uploadPdfBuffer()` não recebe `auditUser`, então uploads de certificados por buffer não são auditados neste método.
- Auditoria não bloqueante pode falhar sem impedir operação.
- `deleteFile()` aceita public_id bruto, exigindo manter validação de pasta rígida.

---

# 13. Melhorias Futuras

- Renomear `uploadImage()` para `uploadInstitucional()`.
- Validar magic bytes dos arquivos.
- Adicionar antivírus/scan para PDFs.
- Permitir auditoria opcional em `uploadPdfBuffer()`.
- Criar fila/retry para deleção de arquivos.
- Armazenar metadados dos arquivos no banco.
- Criar testes unitários para extração de public_id.
- Criar testes de bloqueio de pastas não permitidas.

---

# 14. Resumo Técnico Final

O `UploadService` é uma peça crítica da infraestrutura da API.

Ele integra o backend ao Cloudinary, valida arquivos, faz upload por stream, remove arquivos com proteção por pasta e audita operações sensíveis.

Criticidade: muito alta.

Complexidade: alta.

A implementação é robusta, especialmente na exclusão segura por pastas permitidas e no suporte a resource types diferentes. As principais melhorias são validação por assinatura real, auditoria de uploads por buffer, testes de public_id e padronização dos nomes dos métodos.
