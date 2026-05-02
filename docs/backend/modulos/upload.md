# Módulo: Upload (Cloudinary CDN)

---

# 1. Visão Geral

## Objetivo
Abstrair toda comunicação com o Cloudinary CDN: upload de imagens e PDFs (de arquivo Multer ou buffer em memória), exclusão segura de arquivos, validação de tamanho e restrição de pastas permitidas.

## Responsabilidade
Único ponto de integração com o Cloudinary em toda a aplicação. Exportado como serviço reutilizável por todos os módulos que precisam de upload.

---

# 2. Arquitetura e Metodologias

## Padrões Identificados
- **Facade Pattern:** `UploadService` encapsula completamente o SDK do Cloudinary — os módulos consumidores não conhecem o Cloudinary diretamente
- **Allowlist de Pastas:** validação explícita contra lista branca de pastas permitidas (proteção contra path traversal)
- **Stream-based Upload:** usa `streamifier` para converter `Buffer` em `ReadableStream` — evita gravação em disco temporário
- **Dupla tentativa de delete:** tenta `image` e `raw` resource types ao deletar (cobre PDF e imagem)

---

# 3. Fluxo Interno

## Upload de Imagem (`uploadImage`)
```
1. Valida MIME type: apenas JPG, PNG, WebP, PDF
2. Valida tamanho: máx. 10MB (verificação dupla: file.size + file.buffer.length)
3. PDF → resource_type: 'auto' (sem transformação de qualidade)
4. Imagem → transformation: fetch_format: 'auto', quality: 'auto' (Cloudinary otimiza)
5. Converte buffer → ReadableStream via streamifier
6. Pipe para cloudinary.uploader.upload_stream
7. Registra no AuditLog (entidade: 'Cloudinary_System')
8. Retorna {url: result.secure_url}
```

## Upload de PDF/Documento (`uploadPdf`)
```
1. Valida MIME: apenas PDF ou imagens
2. Valida tamanho: máx. 10MB
3. Pasta: braille_lgpd | braille_atestados | braille_laudos (tipagem literal TypeScript)
4. Imagem → otimização de qualidade; PDF → resource_type: auto
5. Retorna {url: result.secure_url}
```

## Upload de Buffer (`uploadPdfBuffer`)
```
Usado para certificados gerados em memória (pdf-lib)
1. Valida tamanho do buffer
2. resource_type: 'raw' (necessário para PDF no Cloudinary como URL acessível)
3. Força extensão .pdf no public_id (evita ser servido como octet-stream)
4. overwrite: true (re-gera o mesmo certificado sem duplicar)
```

## Exclusão Segura (`deleteFile`)
```
1. Extrai publicId da URL via regex (lida com URLs com versão /v12345/)
2. Gera variantes: com e sem extensão (Set para deduplicar)
3. Valida que publicId está em pasta permitida (allowlist)
4. Tenta deletar com resource_type 'image' e 'raw' sequencialmente
5. Para no primeiro sucesso; 'not found' é tratado como warning (não erro)
6. Registra no AuditLog
```

---

# 4. Dicionário Técnico

## Constantes

| Constante | Valor | Descrição |
|---|---|---|
| `cloudinaryMaxFileSize` | `10 * 1024 * 1024` (10MB) | Limite de tamanho em bytes |
| `cloudinaryAllowedFolders` | `['braille_instituicao', 'braille_lgpd', 'braille_atestados', 'braille_laudos', 'braille_certificados']` | Pastas permitidas |

## Pastas por Tipo de Arquivo

| Pasta | Conteúdo |
|---|---|
| `braille_instituicao` | Fotos de perfil de usuários e alunos, imagens gerais |
| `braille_lgpd` | Termos LGPD assinados (PDF) |
| `braille_atestados` | Atestados médicos (PDF/imagem) |
| `braille_laudos` | Laudos médicos (PDF/imagem) |
| `braille_certificados` | Certificados gerados em PDF |

## Métodos Principais

| Método | Parâmetros | Retorno | Uso |
|---|---|---|---|
| `uploadImage(file, auditUser?)` | Multer.File | `{url: string}` | Foto de perfil, imagens gerais |
| `uploadPdf(file, folder, auditUser?)` | Multer.File + pasta | `{url: string}` | LGPD, atestados, laudos |
| `uploadPdfBuffer(buffer, fileName, folder?)` | Buffer + nome | `{url: string}` | Certificados gerados em memória |
| `deleteFile(fileUrl, auditUser?)` | URL completa | `{success, message}` | Remoção de qualquer arquivo |

---

# 5. Configuração Cloudinary

Configurado no constructor via `ConfigService`:
```typescript
cloudinary.config({
  cloud_name: configService.get('CLOUDINARY_CLOUD_NAME'),
  api_key:    configService.get('CLOUDINARY_API_KEY'),
  api_secret: configService.get('CLOUDINARY_API_SECRET'),
});
```
**Por que ConfigService e não `process.env`?** Garante que as variáveis passaram pela validação do `env.validation.ts` antes de serem usadas.

---

# 6. Segurança

| Medida | Implementação |
|---|---|
| Validação de MIME type | Lista branca explícita de tipos permitidos |
| Limite de tamanho | 10MB verificado antes e durante upload |
| Allowlist de pastas | `validarPastaCloudinary()` rejeita qualquer publicId fora das pastas |
| Path traversal prevention | `extrairPublicIdDeUrl()` decodifica e valida a URL antes de usar |
| Auditoria de uploads e deletes | Todo CRUD no Cloudinary é registrado no AuditLog |

---

# 7. Regras de Negócio

1. **Limite de 10MB:** aplicado tanto pelo Express (`json({ limit: '20mb' })` no main.ts para payload total) quanto pelo `UploadService` para o arquivo individual
2. **Compressão automática:** Cloudinary aplica `quality: 'auto'` e `fetch_format: 'auto'` em imagens — reduz tamanho sem intervenção manual
3. **PDFs não são transformados:** resource_type `auto` ou `raw` — Cloudinary não aplica transformações em PDFs
4. **Delete tolerante a 'not found':** arquivo já deletado não lança erro — idempotência na remoção
5. **Certificados com overwrite:** re-emitir um certificado sobrescreve o arquivo anterior sem criar duplicatas

---

# 8. Pontos de Atenção

> [!WARNING]
> **Cloudinary Free Tier:** O plano gratuito tem limite de 25GB de storage e 25GB de bandwidth/mês. Monitorar o crescimento especialmente de laudos e atestados em PDF.

> [!NOTE]
> **Falha de delete é non-blocking:** Se deletar a foto antiga falhar (ex: arquivo já removido manualmente), o sistema apenas loga `warn` e continua. A URL nova é salva normalmente.

> [!IMPORTANT]
> **Buffer vs Multer:** `uploadPdfBuffer` é usado especificamente para certificados gerados em memória pelo `pdf-lib`. Os demais métodos recebem `Express.Multer.File` vindo do controller via `@UploadedFile()`.

---

# 9. Relação com Outros Módulos

| Módulo | Uso |
|---|---|
| `AuthModule` | Foto de perfil do usuário |
| `UsersModule` | Foto de perfil de funcionários |
| `BeneficiariesModule` | Foto, termo LGPD, laudo (campo principal `laudoUrl`) |
| `LaudosModule` | Histórico de laudos médicos |
| `AtestadosModule` | Atestados de justificativa de falta |
| `CertificadosModule` | PDFs gerados em memória |
| `ApoiadoresModule` | Logo dos apoiadores |

---

# 10. Resumo Técnico Final

O `UploadModule` é o **hub centralizado de armazenamento externo**. Sua abordagem de façade garante que trocar o CDN no futuro (ex: S3 em vez de Cloudinary) impacta apenas este módulo. A validação de pastas por allowlist é crítica para segurança — impede que um atacante force o sistema a deletar arquivos fora do escopo da aplicação.

**Criticidade:** 🟡 Importante | **Complexidade:** Média | **Testes:** `upload.service.spec.ts`, `upload.controller.spec.ts`
