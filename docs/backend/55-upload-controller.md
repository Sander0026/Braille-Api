# 55 — UploadController (`src/upload/upload.controller.ts`)

---

# 1. Visão Geral

O `UploadController` expõe as rotas HTTP responsáveis por receber arquivos multipart/form-data e solicitar exclusão de arquivos armazenados no Cloudinary.

Responsabilidades principais:

- receber upload institucional de imagem/PDF;
- receber upload documental de LGPD, atestado e laudo;
- excluir arquivos por URL;
- aplicar autenticação JWT;
- aplicar autorização por perfil;
- validar tamanho máximo no Multer;
- validar MIME type no ponto de entrada;
- usar `memoryStorage()` para buffer em memória;
- mapear o parâmetro `tipo` para pastas Cloudinary;
- extrair usuário de auditoria com `getAuditUser(req)`;
- delegar processamento ao `UploadService`;
- desativar auditoria automática com `@SkipAudit()`.

---

# 2. Decorators de Classe

```txt
@ApiTags('Uploads de Arquivos')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@SkipAudit()
@Controller('upload')
```

Impacto:

- agrupa rotas de upload no Swagger;
- exige autenticação Bearer;
- aplica `AuthGuard` em todas as rotas;
- desativa auditoria automática;
- define rota base `/upload`.

Ponto importante:

```txt
RolesGuard é aplicado por método, não na classe inteira.
```

---

# 3. Rotas do Controller

| Método | Rota | Perfis | Service | Responsabilidade |
|---|---|---|---|---|
| `POST` | `/upload` | ADMIN/COMUNICACAO | `uploadImage()` | Upload institucional de imagem/PDF |
| `DELETE` | `/upload?url=` | ADMIN/SECRETARIA/COMUNICACAO | `deleteFile()` | Excluir arquivo por URL |
| `POST` | `/upload/pdf?tipo=` | ADMIN/SECRETARIA | `uploadPdf()` | Upload documental de PDF/imagem |

---

# 4. `POST /upload`

## Objetivo

Enviar imagem ou PDF para conteúdo institucional.

Pasta destino no service:

```txt
braille_instituicao
```

## Perfis permitidos

```txt
ADMIN
COMUNICACAO
```

## Guards

```txt
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.COMUNICACAO)
```

## Interceptor

Usa:

```txt
FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: ...
})
```

## Tipos aceitos

No controller:

- qualquer MIME iniciado por `image/`;
- `application/pdf`.

Se o arquivo não for aceito, retorna:

```txt
Tipo de arquivo não suportado. Envie apenas imagens (JPG/PNG/WebP) ou PDF.
```

## Fluxo

1. recebe arquivo no campo `file`;
2. valida presença do arquivo;
3. extrai usuário de auditoria;
4. chama `uploadService.uploadImage(file, auditUser)`.

---

# 5. `DELETE /upload?url=`

## Objetivo

Excluir um arquivo do Cloudinary a partir da URL.

## Perfis permitidos

```txt
ADMIN
SECRETARIA
COMUNICACAO
```

## Guards

```txt
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.SECRETARIA, Role.COMUNICACAO)
```

## Fluxo

1. recebe `url` pela query string;
2. extrai usuário de auditoria;
3. chama `uploadService.deleteFile(url, auditUser)`;
4. service valida URL, pasta permitida e resource type.

## Ponto de segurança

O controller não valida a URL diretamente. Essa responsabilidade fica no `UploadService`, que extrai o `public_id` e valida se pertence a uma das pastas permitidas.

---

# 6. `POST /upload/pdf?tipo=`

## Objetivo

Enviar PDF ou imagem documental relacionada a LGPD, atestado ou laudo.

## Perfis permitidos

```txt
ADMIN
SECRETARIA
```

## Guards

```txt
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.SECRETARIA)
```

## Query obrigatória

```txt
tipo=lgpd|atestado|laudo
```

## Mapeamento de pastas

| `tipo` | Pasta Cloudinary |
|---|---|
| `lgpd` | `braille_lgpd` |
| `atestado` | `braille_atestados` |
| `laudo` | `braille_laudos` |

## Validação do parâmetro `tipo`

Se `tipo` não for um dos valores aceitos, retorna:

```txt
O parâmetro "tipo" deve ser "lgpd", "atestado" ou "laudo".
```

## Interceptor

Também usa `FileInterceptor('file')`, `memoryStorage()` e limite de 10 MB.

Tipos aceitos:

- imagens;
- PDF.

Mensagem de erro:

```txt
Envie apenas arquivos PDF ou imagens (JPG/PNG/WebP).
```

## Fluxo

1. recebe arquivo no campo `file`;
2. valida presença do arquivo;
3. valida query `tipo`;
4. converte `tipo` para pasta Cloudinary;
5. extrai usuário de auditoria;
6. chama `uploadService.uploadPdf(file, folder, auditUser)`.

---

# 7. Validação de Arquivo no Controller

## Limite de tamanho

Ambos os uploads usam:

```txt
10 * 1024 * 1024
```

Equivalente a:

```txt
10 MB
```

## Armazenamento temporário

```txt
memoryStorage()
```

O arquivo fica em memória como `buffer`, e depois o service envia o buffer ao Cloudinary por stream.

## File filter

O controller rejeita tipos inválidos antes de chamar o service.

O service também valida tipos e tamanho, criando uma segunda camada defensiva.

---

# 8. Swagger

O controller usa:

- `@ApiTags`;
- `@ApiBearerAuth`;
- `@ApiConsumes('multipart/form-data')`;
- `@ApiBody`;
- `@ApiOperation`;
- `@ApiQuery`.

Isso permite documentar upload multipart no Swagger.

---

# 9. Auditoria

O controller usa `@SkipAudit()`.

Por isso, envia `getAuditUser(req)` ao service nas rotas:

- upload institucional;
- upload documental;
- exclusão.

O `UploadService` registra auditoria manual na entidade:

```txt
Cloudinary_System
```

---

# 10. Segurança e Qualidade

## Segurança

Pontos fortes:

- todas as rotas exigem JWT;
- upload institucional restrito a ADMIN/COMUNICACAO;
- upload documental restrito a ADMIN/SECRETARIA;
- exclusão restrita a ADMIN/SECRETARIA/COMUNICACAO;
- limite de 10 MB no Multer;
- validação MIME no controller;
- validação de presença do arquivo;
- tipo documental validado antes de mapear pasta;
- auditoria manual via service.

## Qualidade

Pontos positivos:

- controller fino;
- rotas separadas por finalidade;
- query `tipo` define claramente o destino documental;
- Swagger descreve upload multipart;
- permissões são declaradas por endpoint;
- service concentra integração com Cloudinary.

## Performance

- limite de 10 MB reduz risco de pressão excessiva de memória;
- `memoryStorage()` simplifica upload por buffer;
- validação no controller evita chamada externa para arquivos inválidos.

---

# 11. Pontos de Atenção

- MIME type pode ser falsificado; validação por assinatura real ficaria no service ou pipe dedicado.
- `memoryStorage()` exige manutenção rigorosa do limite de tamanho.
- O nome `uploadImage()` no service aceita também PDF, o que pode confundir.
- Não há DTO para validar `tipo` ou `url`; validação é manual.
- O controller não diferencia subtipos de imagem no `fileFilter`; o service faz validação mais específica.

---

# 12. Melhorias Futuras

- Criar DTO/pipe para query `tipo`.
- Criar DTO/pipe para query `url`.
- Criar pipe customizado para validação de arquivo.
- Validar assinatura real do arquivo por magic bytes.
- Separar endpoint institucional de imagem e PDF, se necessário.
- Padronizar nomes de métodos no service.
- Criar testes e2e de upload por perfil e tipo inválido.

---

# 13. Resumo Técnico Final

O `UploadController` é uma camada HTTP segura e objetiva para upload e exclusão de arquivos.

Ele aplica autenticação, roles, limite de tamanho, validação inicial de MIME type e delega integração com Cloudinary ao service.

Criticidade: muito alta.

Complexidade: média/alta.

A implementação é profissional. Os principais próximos passos são validação por assinatura real, DTOs para queries e testes e2e de autorização e arquivos inválidos.
