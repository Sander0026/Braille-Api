# 58 — Certificados: Visão Geral do Módulo (`src/certificados/`)

---

# 1. Visão Geral

O módulo `Certificados` é responsável por gerenciar modelos de certificados, gerar PDFs acadêmicos e honoríficos, armazenar certificados acadêmicos no Cloudinary, validar certificados publicamente por código e regenerar certificados quando dados do aluno mudam.

Arquivos principais:

```txt
src/certificados/certificados.module.ts
src/certificados/certificados.controller.ts
src/certificados/certificados-publico.controller.ts
src/certificados/certificados.service.ts
src/certificados/pdf.service.ts
src/certificados/image-processing.service.ts
src/certificados/dto/create-certificado.dto.ts
src/certificados/dto/update-certificado.dto.ts
src/certificados/dto/emitir-academico.dto.ts
src/certificados/dto/emitir-honraria.dto.ts
```

Responsabilidades principais:

- criar modelos de certificados;
- atualizar modelos e imagens;
- remover modelos e arquivos externos;
- processar assinaturas removendo fundo branco;
- emitir certificado acadêmico para aluno/turma concluída;
- validar frequência mínima de 75%;
- reutilizar certificado acadêmico já emitido com PDF salvo;
- gerar e armazenar PDF acadêmico no Cloudinary;
- emitir certificado de honraria em PDF direto;
- gerar QR Code de validação;
- validar certificado publicamente por código;
- proteger geração de PDF contra SSRF por allowlist de hosts;
- auditar criação, atualização, exclusão e emissão.

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- NestJS Module Pattern;
- Controller-Service Pattern;
- Public Controller Pattern;
- Service Layer;
- PDF Rendering Engine Pattern;
- Template Variable Pattern;
- Cloudinary Storage Pattern;
- Cache Hit Pattern;
- Deterministic Public ID Pattern;
- SSRF Protection Pattern;
- Image Processing Pattern;
- Manual Audit Pattern;
- Soft-fail External Cleanup;
- DTO Pattern.

## Justificativa Técnica

Certificados possuem alto valor institucional. Eles exigem consistência entre aluno, turma, modelo, frequência, PDF gerado e código público de validação.

O módulo separa responsabilidades:

```txt
CertificadosController → HTTP administrativo
CertificadosPublicoController → validação pública
CertificadosService → regras de negócio
PdfService → engine de renderização PDF
ImageProcessingService → tratamento de assinaturas
UploadService → persistência no Cloudinary
```

---

# 3. CertificadosModule

Importa:

- `UploadModule`;
- `AuditLogModule`;
- `ConfigModule`.

Declara controllers:

- `CertificadosController`;
- `CertificadosPublicoController`.

Declara providers:

- `CertificadosService`;
- `PrismaService`;
- `PdfService`;
- `ImageProcessingService`.

Exporta:

- `PdfService`;
- `CertificadosService`.

O `ConfigModule` é importado localmente para garantir `ConfigService` no `PdfService` sem depender de configuração global.

---

# 4. Controllers

## CertificadosController

Base route:

```txt
/modelos-certificados
```

Proteção:

```txt
@UseGuards(AuthGuard, RolesGuard)
@SkipAudit()
```

Rotas principais:

| Método | Rota | Perfis | Responsabilidade |
|---|---|---|---|
| `POST` | `/modelos-certificados/emitir-academico` | ADMIN/SECRETARIA/PROFESSOR | Emitir/recuperar certificado acadêmico |
| `POST` | `/modelos-certificados/emitir-honraria` | ADMIN/SECRETARIA | Emitir PDF de honraria |
| `POST` | `/modelos-certificados` | ADMIN/SECRETARIA | Criar modelo |
| `GET` | `/modelos-certificados` | ADMIN/SECRETARIA/PROFESSOR/COMUNICACAO | Listar modelos |
| `GET` | `/modelos-certificados/:id` | ADMIN/SECRETARIA/PROFESSOR/COMUNICACAO | Buscar modelo |
| `PATCH` | `/modelos-certificados/:id` | ADMIN/SECRETARIA | Atualizar modelo |
| `DELETE` | `/modelos-certificados/:id` | ADMIN/SECRETARIA | Remover modelo |

## CertificadosPublicoController

Base route:

```txt
/certificados
```

Rota pública:

| Método | Rota | Auth | Responsabilidade |
|---|---|---|---|
| `GET` | `/certificados/validar/:codigo` | Pública | Validar autenticidade por código |

---

# 5. Modelos de Certificado

Um modelo contém:

- nome;
- tipo (`ACADEMICO` ou `HONRARIA`);
- texto template;
- arte base;
- assinatura principal;
- assinatura secundária opcional;
- nomes/cargos dos assinantes;
- layoutConfig JSON.

Arquivos exigidos na criação:

- `arteBase`;
- `assinatura`.

Arquivo opcional:

- `assinatura2`.

Tipos aceitos:

- JPG;
- PNG;
- WebP.

Limite:

```txt
10 MB
```

---

# 6. Emissão Acadêmica

Endpoint:

```txt
POST /modelos-certificados/emitir-academico
```

Fluxo macro:

1. busca turma;
2. inclui modelo e matrícula do aluno;
3. valida se aluno cursa a turma;
4. valida se turma ou matrícula está concluída;
5. valida se turma possui modelo;
6. verifica frequência mínima;
7. procura certificado já emitido com PDF salvo;
8. se existir, retorna cache hit;
9. busca dados mínimos do aluno;
10. substitui tags no texto;
11. gera ou reutiliza código de validação;
12. constrói PDF;
13. faz upload do PDF com public_id determinístico;
14. cria ou atualiza `CertificadoEmitido`;
15. retorna `pdfUrl` e `codigoValidacao`.

Public ID determinístico:

```txt
cert-acad-{alunoId}-{turmaId}
```

---

# 7. Emissão de Honraria

Endpoint:

```txt
POST /modelos-certificados/emitir-honraria
```

Fluxo:

1. busca modelo;
2. valida se modelo é do tipo `HONRARIA`;
3. substitui tags `PARCEIRO`, `MOTIVO` e `DATA`;
4. gera código de validação;
5. cria `CertificadoEmitido` sem aluno/turma;
6. audita emissão;
7. constrói PDF;
8. retorna `StreamableFile` com `Content-Type: application/pdf`.

O código de validação é retornado no header:

```txt
X-Codigo-Validacao
```

---

# 8. Validação Pública

Endpoint:

```txt
GET /certificados/validar/:codigo
```

Regras:

- rejeita códigos com mais de 20 caracteres;
- aceita somente padrão `[A-Z0-9-]+`;
- busca `CertificadoEmitido` por `codigoValidacao`;
- retorna dados públicos mínimos.

Retorno inclui:

- `valido`;
- nome;
- curso/modelo;
- data;
- tipo.

---

# 9. PdfService

Responsabilidades:

- carregar arte base;
- carregar assinaturas;
- carregar fontes;
- renderizar texto;
- renderizar nome do aluno;
- renderizar assinaturas;
- gerar QR Code;
- montar PDF final com `pdf-lib`;
- proteger carregamento externo contra SSRF.

Allowlist de imagem:

```txt
res.cloudinary.com
```

Allowlist de fonte:

```txt
raw.githubusercontent.com
```

---

# 10. ImageProcessingService

Responsável por remover fundo branco/claro de assinaturas usando Jimp.

Regras principais:

- luminosidade acima de 235 vira transparente;
- luminosidade entre 190 e 235 recebe alpha proporcional;
- luminosidade abaixo de 190 permanece opaca;
- se falhar, retorna imagem original.

---

# 11. Segurança e Qualidade

## Segurança

- rotas administrativas protegidas por JWT e roles;
- rota pública valida formato do código antes de consultar;
- emissão acadêmica usa select mínimo do aluno;
- frequência mínima é validada;
- geração de PDF usa allowlist de hosts;
- uploads de modelo aceitam apenas imagens;
- Cloudinary usa public_id determinístico para certificados acadêmicos.

## Qualidade

- responsabilidades bem separadas;
- cache em listagem/detalhe e validação pública;
- cache hit de certificado já emitido;
- geração PDF centralizada;
- tags centralizadas em `substituirTags()`;
- parse de layoutConfig tolerante a erro;
- regeneração não bloqueia alteração do aluno.

---

# 12. Pontos de Atenção

- Auditoria em alguns pontos não usa `.catch()`, podendo falhar junto com a operação se o AuditLog falhar.
- `parseLayoutConfig()` retorna `undefined` em JSON inválido, não rejeita payload inválido.
- `trocarArquivo()` remove arquivo antigo antes de subir o novo, podendo gerar inconsistência se upload falhar.
- `emitirHonraria()` cria registro antes de construir PDF; se PDF falhar, fica emissão sem PDF.
- `uploadPdfBuffer()` não recebe auditUser no UploadService.
- `validarPublico()` retorna dados mínimos, mas ainda deve ser considerado endpoint público sensível.

---

# 13. Melhorias Futuras

- Auditar falhas com `.catch()` em todas as chamadas de audit;
- validar `layoutConfig` com schema;
- alterar ordem de troca de arquivo para upload novo antes de delete antigo;
- adicionar transação/compensação em emissão de honraria;
- persistir `pdfUrl` também para honraria;
- criar política de revogação de certificado;
- adicionar status de certificado emitido;
- criar testes de SSRF no PdfService;
- criar testes de frequência mínima;
- criar testes de cache hit acadêmico.

---

# 14. Resumo Técnico Final

O módulo `Certificados` é uma das partes mais sofisticadas da API.

Ele combina CRUD de modelos, processamento de imagens, geração de PDF, Cloudinary, validação pública, QR Code, frequência mínima e cache de certificados emitidos.

Criticidade: muito alta.

Complexidade: muito alta.

A implementação é profissional e bem separada. Os principais próximos passos são validar layoutConfig com schema, fortalecer auditoria não bloqueante, revisar fluxos de compensação em arquivos/PDF e criar testes de SSRF, emissão e frequência mínima.
