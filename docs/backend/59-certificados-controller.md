# 59 — CertificadosController e CertificadosPublicoController

---

# 1. Visão Geral

Este documento descreve os controllers do módulo `Certificados`:

```txt
src/certificados/certificados.controller.ts
src/certificados/certificados-publico.controller.ts
```

Responsabilidades principais:

- expor rotas administrativas de modelos de certificados;
- emitir certificados acadêmicos;
- emitir certificados de honraria;
- criar, listar, buscar, atualizar e remover modelos;
- receber imagens multipart para arte base e assinaturas;
- aplicar autenticação e autorização por perfil;
- aplicar cache em leituras;
- expor rota pública de validação por código.

---

# 2. CertificadosController

## Base route

```txt
/modelos-certificados
```

## Decorators de classe

```txt
@ApiTags('Modelos de Certificados')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@SkipAudit()
@Controller('modelos-certificados')
```

Impacto:

- exige autenticação JWT;
- exige controle de roles;
- agrupa endpoints administrativos no Swagger;
- desativa auditoria automática;
- delega auditoria manual ao service.

---

# 3. Rotas Administrativas

| Método | Rota | Perfis | Responsabilidade |
|---|---|---|---|
| `POST` | `/modelos-certificados/emitir-academico` | ADMIN/SECRETARIA/PROFESSOR | Emitir ou recuperar certificado acadêmico |
| `POST` | `/modelos-certificados/emitir-honraria` | ADMIN/SECRETARIA | Emitir certificado de honraria |
| `POST` | `/modelos-certificados` | ADMIN/SECRETARIA | Criar modelo |
| `GET` | `/modelos-certificados` | ADMIN/SECRETARIA/PROFESSOR/COMUNICACAO | Listar modelos |
| `GET` | `/modelos-certificados/:id` | ADMIN/SECRETARIA/PROFESSOR/COMUNICACAO | Buscar modelo |
| `PATCH` | `/modelos-certificados/:id` | ADMIN/SECRETARIA | Atualizar modelo |
| `DELETE` | `/modelos-certificados/:id` | ADMIN/SECRETARIA | Remover modelo |

---

# 4. Emissão Acadêmica

Endpoint:

```txt
POST /modelos-certificados/emitir-academico
```

DTO:

```txt
EmitirAcademicoDto
```

Perfis:

```txt
ADMIN
SECRETARIA
PROFESSOR
```

Fluxo no controller:

1. recebe body com `turmaId` e `alunoId`;
2. extrai `auditUser` do request;
3. chama `certificadosService.emitirAcademico(dto, auditUser)`;
4. retorna JSON com:

```txt
pdfUrl
codigoValidacao
```

Observação:

```txt
O PDF acadêmico é armazenado no Cloudinary e o frontend abre a URL retornada.
```

---

# 5. Emissão de Honraria

Endpoint:

```txt
POST /modelos-certificados/emitir-honraria
```

DTO:

```txt
EmitirHonrariaDto
```

Perfis:

```txt
ADMIN
SECRETARIA
```

Fluxo no controller:

1. recebe dados da honraria;
2. extrai `auditUser`;
3. chama `certificadosService.emitirHonraria(dto, auditUser)`;
4. recebe `pdfBuffer` e `codigoValidacao`;
5. define headers HTTP;
6. retorna `StreamableFile`.

Headers definidos:

```txt
Content-Type: application/pdf
Content-Disposition: inline; filename="honorific_braille.pdf"
X-Codigo-Validacao: {codigoValidacao}
```

---

# 6. Criação de Modelo

Endpoint:

```txt
POST /modelos-certificados
```

Perfis:

```txt
ADMIN
SECRETARIA
```

Consome:

```txt
multipart/form-data
```

Campos de arquivo:

| Campo | Obrigatório | Objetivo |
|---|---:|---|
| `arteBase` | Sim | Imagem base do certificado |
| `assinatura` | Sim | Assinatura principal |
| `assinatura2` | Não | Segunda assinatura |

Se `arteBase` ou `assinatura` não forem enviados, retorna erro:

```txt
As imagens da arteBase e da assinatura principal são obrigatórias na criação.
```

O controller chama:

```txt
certificadosService.create(createDto, arteBaseFile, assinaturaFile, assinatura2File, auditUser)
```

---

# 7. Atualização de Modelo

Endpoint:

```txt
PATCH /modelos-certificados/:id
```

Perfis:

```txt
ADMIN
SECRETARIA
```

Consome:

```txt
multipart/form-data
```

Pode receber:

- dados textuais do modelo;
- `arteBase`;
- `assinatura`;
- `assinatura2`.

Arquivos são opcionais na atualização.

O controller extrai cada arquivo e delega ao service.

---

# 8. Remoção de Modelo

Endpoint:

```txt
DELETE /modelos-certificados/:id
```

Perfis:

```txt
ADMIN
SECRETARIA
```

Fluxo:

1. recebe ID;
2. extrai auditUser;
3. chama `certificadosService.remove(id, auditUser)`;
4. service remove modelo e tenta remover arquivos externos.

---

# 9. Listagem e Detalhe

## Listar

Endpoint:

```txt
GET /modelos-certificados
```

Perfis:

```txt
ADMIN
SECRETARIA
PROFESSOR
COMUNICACAO
```

Usa:

```txt
CacheInterceptor
CacheTTL(30000)
```

## Buscar por ID

Endpoint:

```txt
GET /modelos-certificados/:id
```

Também usa cache de leitura.

---

# 10. Upload de Imagens do Modelo

O controller usa:

```txt
FileFieldsInterceptor
memoryStorage()
```

Campos permitidos:

```txt
arteBase
assinatura
assinatura2
```

Limite:

```txt
10 MB
```

MIME types aceitos:

- `image/jpeg`;
- `image/png`;
- `image/webp`.

Se o tipo for inválido, retorna:

```txt
Tipo de arquivo não suportado. Envie apenas imagens JPG, PNG ou WebP.
```

---

# 11. CertificadosPublicoController

## Base route

```txt
/certificados
```

## Rota

```txt
GET /certificados/validar/:codigo
```

## Características

- pública;
- sem `AuthGuard`;
- usa cache;
- consulta dados mínimos;
- valida autenticidade de certificado por código.

Cache:

```txt
CacheInterceptor
CacheTTL(60000)
```

Chama:

```txt
certificadosService.validarPublico(codigo)
```

---

# 12. Auditoria

O controller administrativo usa:

```txt
@SkipAudit()
```

Por isso, mutações enviam `getAuditUser(req)` ao service:

- emissão acadêmica;
- emissão de honraria;
- criação de modelo;
- atualização de modelo;
- remoção de modelo.

A rota pública de validação não audita consulta na implementação atual.

---

# 13. Segurança e Qualidade

## Segurança

Pontos fortes:

- controller administrativo exige JWT e roles;
- uploads de modelo aceitam apenas imagens;
- professores podem emitir acadêmico, mas não alterar modelos;
- honraria restrita a ADMIN/SECRETARIA;
- validação pública não expõe dados sensíveis como CPF/RG;
- cache reduz abuso de validação repetida.

## Qualidade

Pontos positivos:

- separação entre controller administrativo e público;
- uso de `StreamableFile` para PDF de honraria;
- multipart configurado com campos específicos;
- cache em leituras;
- extração consistente de `auditUser`.

---

# 14. Pontos de Atenção

- `@Roles()` usa strings em vez do enum `Role`.
- Cache de listagem/detalhe pode ficar temporariamente defasado após mutações.
- Rota pública de validação não tem rate limit específico.
- Upload usa MIME type, mas não valida assinatura real da imagem.
- `CacheTTL(30000)` e `CacheTTL(60000)` precisam ter unidade confirmada conforme versão/configuração.

---

# 15. Melhorias Futuras

- Padronizar roles com enum `Role`.
- Criar invalidação de cache após mutações.
- Adicionar rate limit na validação pública.
- Validar magic bytes das imagens.
- Criar DTO de params para IDs e código.
- Auditar validações públicas se a política exigir rastreio.
- Documentar respostas Swagger de erro e sucesso com schemas.

---

# 16. Resumo Técnico Final

Os controllers de certificados estão bem separados entre área administrativa e validação pública.

O `CertificadosController` concentra CRUD de modelos e emissão, enquanto o `CertificadosPublicoController` oferece validação aberta por código.

Criticidade: muito alta.

Complexidade: alta.

A implementação é profissional. Os principais próximos passos são padronizar roles, proteger validação pública com rate limit, validar assinatura real das imagens e invalidar cache após mutações.
