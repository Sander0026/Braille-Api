# 57 — Upload: Cloudinary, Segurança e Arquivos

---

# 1. Visão Geral

Este documento detalha os aspectos de segurança e integração externa do módulo `Upload`, com foco em Cloudinary, validação de arquivos, pastas permitidas, exclusão segura e auditoria.

Arquivos relacionados:

```txt
src/upload/upload.controller.ts
src/upload/upload.service.ts
src/upload/upload.module.ts
```

Objetivos principais:

- documentar como arquivos são enviados ao Cloudinary;
- explicar o uso de streams;
- explicar validações de tamanho e tipo;
- documentar pastas permitidas;
- explicar exclusão segura por `public_id`;
- mapear riscos de MIME spoofing;
- registrar pontos de melhoria para segurança documental.

---

# 2. Cloudinary como Storage Externo

O sistema não armazena arquivos binários diretamente no banco de dados.

Fluxo geral:

```txt
Cliente envia arquivo → API valida → UploadService envia ao Cloudinary → API retorna URL → módulo de negócio persiste URL
```

Módulos consumidores:

- Beneficiaries;
- Atestados;
- Certificados;
- Comunicados/conteúdo institucional.

Vantagens:

- reduz peso no banco;
- centraliza armazenamento externo;
- permite otimização automática de imagem;
- separa arquivo físico de entidade de negócio.

---

# 3. Credenciais e Configuração

O `UploadService` configura o SDK Cloudinary com:

```txt
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

Esses valores vêm do `ConfigService`.

Ponto de segurança:

```txt
As credenciais devem existir somente em variáveis de ambiente e nunca em código-fonte.
```

---

# 4. Pastas Funcionais

Pastas usadas pelo sistema:

| Pasta | Uso |
|---|---|
| `braille_instituicao` | Conteúdo institucional, imagens e PDFs gerais |
| `braille_lgpd` | Termos LGPD |
| `braille_atestados` | Atestados médicos |
| `braille_laudos` | Laudos médicos |
| `braille_certificados` | Certificados gerados em PDF |

Essas pastas ajudam a separar tipos de documentos e aplicar regras futuras de retenção, auditoria e acesso.

---

# 5. Pastas Permitidas para Exclusão

Constante no service:

```txt
cloudinaryAllowedFolders
```

Lista:

```txt
braille_instituicao
braille_lgpd
braille_atestados
braille_laudos
braille_certificados
```

## Regra

Antes de deletar, o service valida:

```txt
publicId === folder || publicId.startsWith(`${folder}/`)
```

Isso impede que uma requisição tente excluir arquivos fora do escopo da aplicação.

---

# 6. Validação de Arquivo

## Tamanho máximo

Limite:

```txt
10 MB
```

Aplicado em:

- Multer no controller;
- validação no service;
- upload de PDF em buffer.

## Tipos aceitos

Documentos aceitos:

- PDF;
- imagens JPG/JPEG;
- PNG;
- WebP.

## Camadas de validação

| Camada | Validação |
|---|---|
| Controller | MIME e limite Multer |
| Service | MIME específico e tamanho real |
| Cloudinary | Rejeição externa se exceder limite/plano |

## Ponto de atenção

MIME type pode ser falsificado pelo cliente.

Melhoria recomendada:

```txt
validar assinatura real do arquivo por magic bytes
```

---

# 7. Upload por Stream

O service converte buffers em stream usando:

```txt
streamifier.createReadStream(file.buffer).pipe(uploadStream)
```

Cloudinary recebe o stream por:

```txt
cloudinary.uploader.upload_stream()
```

Vantagens:

- evita escrita temporária em disco;
- simplifica infraestrutura;
- combina bem com limite de 10 MB;
- reduz superfície de limpeza de arquivos locais.

Ponto de atenção:

```txt
Como usa memoryStorage, o limite de tamanho precisa ser rigorosamente mantido.
```

---

# 8. Resource Types

Cloudinary pode armazenar recursos como:

- `image`;
- `raw`;
- `auto`.

## Imagens

Usam:

```txt
resource_type: image
```

Com transformação:

```txt
quality: auto
fetch_format: auto
```

## PDFs documentais

Usam:

```txt
resource_type: auto
```

## PDFs gerados em buffer

Usam:

```txt
resource_type: raw
```

Motivo:

```txt
Certificados em PDF precisam manter extensão e comportamento previsível no Cloudinary.
```

---

# 9. Extração de Public ID

`deleteFile()` precisa converter URL pública em `public_id`.

Fluxo:

1. faz parse da URL;
2. localiza o segmento `upload`;
3. remove versão `v123...` quando existir;
4. junta o restante do path;
5. decodifica caracteres especiais;
6. gera variações com e sem extensão.

Exemplo conceitual:

```txt
https://res.cloudinary.com/.../upload/v123/braille_lgpd/termo.pdf
→ braille_lgpd/termo.pdf
→ braille_lgpd/termo
```

Gerar duas variações aumenta a chance de encontrar o arquivo correto, pois imagens e PDFs podem se comportar diferente quanto à extensão.

---

# 10. Exclusão Segura

Método:

```txt
deleteFile(fileUrl, auditUser?)
```

Fluxo:

1. valida presença da URL;
2. extrai possíveis public_ids;
3. valida se todos pertencem a pastas permitidas;
4. define ordem de resource types;
5. tenta destruir no Cloudinary;
6. considera sucesso quando `result = ok`;
7. se `not found`, tenta variações;
8. se erro inesperado, lança erro público seguro;
9. registra auditoria de exclusão.

## Proteção contra deleção indevida

A whitelist de pastas é o principal controle de segurança.

Sem ela, um usuário com permissão de delete poderia tentar apagar qualquer arquivo acessível via public_id.

---

# 11. Auditoria

Entidade:

```txt
Cloudinary_System
```

Ações:

- `CRIAR` para upload;
- `EXCLUIR` para delete.

Dados registrados:

- public_id;
- URL;
- pasta;
- autor;
- IP;
- user agent.

Auditoria é best-effort:

```txt
falha de auditoria → warning
operação principal → continua
```

---

# 12. Riscos e Mitigações

| Risco | Mitigação Atual | Melhoria Recomendada |
|---|---|---|
| MIME spoofing | Validação MIME no controller/service | Magic bytes |
| Arquivo grande | Limite 10 MB em controller/service | Limites por tipo |
| Delete fora do sistema | Whitelist de pastas | Testes automatizados |
| PDF malicioso | Restrição de tipo/tamanho | Antivírus/scan |
| Auditoria falhar | Warning | Fila/retry |
| Arquivo órfão | Cleanup best-effort | Job periódico |
| URL/public_id malformado | BadRequest | DTO/pipe específico |

---

# 13. Relação com Outros Módulos

| Módulo | Relação |
|---|---|
| Beneficiaries | Usa URLs de foto, LGPD, laudo e atestado |
| Atestados | Usa URL de arquivo e cleanup ao atualizar |
| Certificados | Usa PDF buffer para salvar certificados |
| Comunicados | Pode usar upload institucional |
| AuditLog | Registra upload/delete |

---

# 14. Melhorias Futuras

- Implementar validação por magic bytes;
- adicionar antivírus/scan para PDFs;
- armazenar metadados dos arquivos no banco;
- criar política de retenção por pasta;
- criar fila/retry para deleções;
- criar job de limpeza de órfãos;
- criar DTO/pipe para `url` e `tipo`;
- criar testes unitários de public_id;
- criar testes e2e de upload inválido;
- auditar upload de PDF buffer.

---

# 15. Resumo Técnico Final

A integração com Cloudinary está bem estruturada e possui controles importantes: limite de tamanho, validação de tipo, pastas funcionais, exclusão segura por whitelist e auditoria.

Criticidade: muito alta.

Complexidade: alta.

Os principais pontos de evolução são validação por assinatura real, scan de documentos, metadados persistidos e rotina de limpeza/retry para arquivos órfãos.
