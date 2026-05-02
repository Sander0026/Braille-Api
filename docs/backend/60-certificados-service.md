# 60 — CertificadosService (`src/certificados/certificados.service.ts`)

---

# 1. Visão Geral

O `CertificadosService` concentra as regras de negócio do módulo de certificados.

Ele gerencia modelos, emissão acadêmica, emissão de honraria, geração de código de validação, cache de certificados emitidos, upload de PDFs no Cloudinary, regeneração de certificados acadêmicos e validação pública.

Responsabilidades principais:

- criar modelos de certificado;
- processar e enviar assinaturas;
- atualizar imagens e dados de modelos;
- remover modelos e arquivos externos;
- emitir certificados acadêmicos;
- validar matrícula e conclusão;
- validar frequência mínima de 75%;
- evitar regeração desnecessária com cache hit;
- gerar PDFs por `PdfService`;
- salvar PDFs acadêmicos no Cloudinary;
- emitir certificados de honraria em buffer;
- regenerar certificados quando nome do aluno muda;
- validar certificados publicamente por código;
- registrar auditoria manual.

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- Service Layer;
- Domain Service Pattern;
- Cloudinary Storage Pattern;
- PDF Generation Orchestration Pattern;
- Cache Hit Pattern;
- Deterministic Public ID Pattern;
- Template Variable Replacement Pattern;
- Manual Audit Pattern;
- Best-effort External Cleanup;
- Background Regeneration Pattern;
- Defensive Validation Pattern;
- Minimal Select Pattern.

## Justificativa Técnica

Certificados dependem de várias entidades e serviços: aluno, turma, matrícula, modelo, frequência, PDF, Cloudinary e validação pública.

O service atua como orquestrador, mantendo a regra de negócio fora do controller e concentrando integrações externas em serviços especializados.

---

# 3. Dependências

| Dependência | Uso |
|---|---|
| `PrismaService` | Persistência de modelos, turmas, alunos, frequências e certificados emitidos |
| `UploadService` | Upload/delete de arquivos no Cloudinary |
| `PdfService` | Construção do PDF final |
| `ImageProcessingService` | Remoção de fundo branco das assinaturas |
| `AuditLogService` | Auditoria manual |
| `randomBytes` | Geração de código de validação |

Tipos/Enums:

- `Prisma`;
- `AuditAcao`;
- `AuditUser`;
- `ModeloPdf`;
- `HonrariaPdfResult`.

---

# 4. Helpers Privados

## `toAuditMeta()`

Converte `AuditUser` para campos esperados pela auditoria:

- `autorId`;
- `autorNome`;
- `autorRole`;
- `ip`;
- `userAgent`.

## `uploadAssinatura()`

Fluxo:

1. recebe imagem de assinatura;
2. chama `imageProcessing.removerFundoBrancoAssinatura()`;
3. força saída como PNG;
4. envia para Cloudinary via `uploadService.uploadImage()`;
5. retorna URL.

Objetivo:

```txt
padronizar assinaturas com fundo transparente
```

## `trocarArquivo()`

Responsável por substituir arquivos de modelo.

Fluxo:

1. se não há novo arquivo, mantém URL atual;
2. se há arquivo antigo, tenta deletar no Cloudinary;
3. se delete falhar, registra warning e continua;
4. se for assinatura, processa fundo branco;
5. se não for assinatura, envia arquivo diretamente;
6. retorna nova URL.

Ponto de atenção:

```txt
O arquivo antigo é deletado antes do upload novo. Se o upload novo falhar, pode haver inconsistência externa.
```

## `substituirTags()`

Substitui variáveis no texto template.

Formato:

```txt
{{TAG}}
```

Exemplos:

- `{{ALUNO}}`;
- `{{TURMA}}`;
- `{{CARGA_HORARIA}}`;
- `{{DATA_INICIO}}`;
- `{{DATA_FIM}}`;
- `{{PARCEIRO}}`;
- `{{MOTIVO}}`;
- `{{DATA}}`.

## `verificarFrequencia()`

Valida frequência mínima de 75% para emissão acadêmica.

Regras:

- se não houver registros de frequência, não bloqueia emissão;
- conta presenças quando `presente = true` ou `status` está em `PRESENTE`/`FALTA_JUSTIFICADA`;
- calcula taxa arredondada;
- se taxa menor que 75%, lança `BadRequestException`.

## `parseLayoutConfig()`

Tenta converter JSON serializado em objeto Prisma JSON.

Regras:

- string vazia retorna `Prisma.JsonNull`;
- valor ausente retorna `undefined`;
- JSON inválido gera warning e retorna `undefined`.

---

# 5. CRUD de Modelos

## `create()`

Fluxo:

1. recebe DTO e arquivos;
2. envia `arteBase`, `assinatura` e `assinatura2` em paralelo;
3. assinatura passa por remoção de fundo branco;
4. parseia `layoutConfig`;
5. cria `ModeloCertificado`;
6. registra auditoria `CRIAR`;
7. retorna modelo criado.

Arquivos obrigatórios são validados no controller.

## `findAll()`

Retorna todos os modelos ordenados por:

```txt
criadoEm desc
```

## `findOne()`

Busca modelo por ID.

Se não encontrar, lança:

```txt
NotFoundException('Modelo de certificado não encontrado.')
```

## `update()`

Fluxo:

1. busca modelo atual;
2. troca arquivos enviados;
3. parseia novo `layoutConfig`;
4. atualiza dados do modelo;
5. registra auditoria `ATUALIZAR`;
6. retorna modelo atualizado.

## `remove()`

Fluxo:

1. busca modelo;
2. tenta remover arte base e assinaturas no Cloudinary com `Promise.allSettled()`;
3. falhas de Cloudinary viram warning;
4. deleta modelo no banco;
5. registra auditoria `EXCLUIR`;
6. retorna modelo excluído.

---

# 6. Emissão Acadêmica

## Método

```txt
emitirAcademico(dto, auditUser?)
```

## Entrada

```txt
turmaId
alunoId
```

## Regras de Negócio

- turma precisa existir;
- aluno precisa estar matriculado na turma;
- turma ou matrícula precisa estar `CONCLUIDA`;
- turma precisa ter modelo de certificado configurado;
- frequência mínima precisa ser de pelo menos 75%, quando houver dados de frequência;
- certificado já emitido com `pdfUrl` deve ser reaproveitado.

## Fluxo

1. busca turma com modelo e matrícula do aluno;
2. valida matrícula;
3. valida conclusão;
4. valida modelo;
5. valida frequência;
6. busca certificado emitido existente;
7. se existir com PDF, retorna cache hit;
8. busca dados mínimos do aluno;
9. monta texto com tags substituídas;
10. gera ou reaproveita código de validação;
11. chama `pdfService.construirPdfBase()`;
12. salva PDF no Cloudinary via `uploadPdfBuffer()`;
13. cria ou atualiza registro `CertificadoEmitido`;
14. audita criação quando novo registro é criado;
15. retorna `pdfUrl` e `codigoValidacao`.

## Cache Hit

Se já existir certificado com `pdfUrl`, o service retorna imediatamente:

```txt
pdfUrl
codigoValidacao
```

Sem regenerar PDF.

## Public ID Determinístico

Formato:

```txt
cert-acad-{alunoId}-{turmaId}
```

Benefícios:

- overwrite controlado;
- evita arquivos órfãos;
- facilita regeneração.

---

# 7. Emissão de Honraria

## Método

```txt
emitirHonraria(dto, auditUser?)
```

## Entrada

```txt
modeloId
nomeParceiro
motivo
dataEmissao
```

## Regras

- modelo precisa existir;
- modelo precisa ser do tipo `HONRARIA`;
- gera código de validação;
- cria `CertificadoEmitido` sem aluno/turma;
- gera PDF e retorna buffer.

## Fluxo

1. busca modelo;
2. valida tipo `HONRARIA`;
3. substitui tags `PARCEIRO`, `MOTIVO` e `DATA`;
4. gera código aleatório;
5. cria emissão;
6. audita criação;
7. constrói PDF;
8. retorna `pdfBuffer` e `codigoValidacao`.

Ponto de atenção:

```txt
O registro é criado antes do PDF. Se a construção do PDF falhar, pode existir emissão sem PDF entregue.
```

---

# 8. Regeneração de Certificados do Aluno

## Método

```txt
regenerarCertificadosAluno(alunoId)
```

## Objetivo

Regenerar certificados acadêmicos já emitidos quando o nome completo do aluno muda.

## Características

- executado em background por módulo consumidor;
- não bloqueia PATCH do aluno;
- processa somente certificados que já têm `pdfUrl`;
- reutiliza o mesmo `codigoValidacao`;
- usa public ID determinístico;
- atualiza `pdfUrl` no banco;
- falhas individuais geram warning e não interrompem o loop.

---

# 9. Validação Pública

## Método

```txt
validarPublico(codigo)
```

## Regras de Segurança

Antes de consultar banco, valida formato:

```txt
codigo.length <= 20
/^[A-Z0-9-]+$/
```

Se inválido, retorna `NotFoundException` genérico.

## Fluxo

1. valida formato do código;
2. busca `CertificadoEmitido` por `codigoValidacao`;
3. inclui aluno, turma e modelo com dados mínimos;
4. se não encontrar, retorna `NotFoundException` genérico;
5. define se é acadêmico;
6. retorna dados públicos mínimos.

Retorno:

```txt
valido
nome
curso
data
tipo
```

---

# 10. Auditoria

Entidades auditadas:

| Entidade | Operações |
|---|---|
| `ModeloCertificado` | Criar, atualizar, excluir |
| `CertificadoEmitido` | Emitir acadêmico novo, emitir honraria |

Ações usadas:

- `CRIAR`;
- `ATUALIZAR`;
- `EXCLUIR`.

Ponto de atenção: algumas chamadas de auditoria não usam `.catch()`, então uma falha no audit pode afetar o fluxo.

---

# 11. Segurança e Qualidade

## Segurança

- emissão acadêmica valida matrícula;
- emissão acadêmica valida conclusão;
- emissão acadêmica valida frequência mínima;
- validação pública usa formato restrito;
- select do aluno evita CPF/RG/laudos;
- modelos inexistentes retornam erro controlado;
- honraria exige modelo do tipo correto.

## Qualidade

- service centraliza regra institucional;
- PDF fica em service especializado;
- assinatura fica em service especializado;
- upload fica em service especializado;
- tags possuem método central;
- cache hit reduz custo operacional;
- regeneração é tolerante a falhas.

## Performance

- uploads de modelo são paralelos;
- cache hit evita gerar PDF repetidamente;
- select mínimo reduz payload;
- public ID determinístico evita acúmulo de arquivos;
- regeneração processa somente certificados com PDF salvo.

---

# 12. Pontos de Atenção

- `trocarArquivo()` deleta arquivo antigo antes de subir o novo.
- `parseLayoutConfig()` não rejeita JSON inválido.
- Auditoria sem `.catch()` pode falhar junto da operação principal.
- Honraria cria emissão antes de gerar PDF.
- `uploadPdfBuffer()` não recebe `auditUser`.
- `verificarFrequencia()` não bloqueia emissão quando não há registros de frequência.
- Código de validação usa 4 bytes em hex, gerando 8 caracteres; colisão é improvável, mas não impossível.

---

# 13. Melhorias Futuras

- Alterar troca de arquivo para upload novo antes do delete antigo.
- Validar `layoutConfig` com JSON Schema.
- Adicionar `.catch()` nas auditorias não críticas.
- Envolver emissão de honraria em estratégia de compensação.
- Persistir PDF de honraria em Cloudinary, se desejado.
- Adicionar retry em caso de colisão de código.
- Tornar política de frequência sem registros configurável.
- Auditar `uploadPdfBuffer()` com autor quando aplicável.
- Criar testes de cache hit, frequência mínima e validação pública.

---

# 14. Resumo Técnico Final

O `CertificadosService` é o centro de orquestração do domínio de certificados.

Ele combina regras acadêmicas, emissão institucional, PDF, Cloudinary, auditoria, cache, validação pública e regeneração.

Criticidade: muito alta.

Complexidade: muito alta.

A implementação é robusta e bem separada. Os principais pontos de evolução são fortalecer transações/compensações, validar layoutConfig, tornar auditoria não bloqueante e criar testes de emissão, frequência e validação pública.
