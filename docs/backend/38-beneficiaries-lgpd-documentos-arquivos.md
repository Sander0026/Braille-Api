# 38 — Beneficiaries: LGPD, Documentos e Arquivos

---

# 1. Visão Geral

## Objetivo

Documentar os campos, fluxos e cuidados técnicos relacionados a LGPD, documentos e arquivos do módulo `Beneficiaries`.

Arquivos relacionados:

```txt
src/beneficiaries/dto/create-beneficiary.dto.ts
src/beneficiaries/dto/update-beneficiary.dto.ts
src/beneficiaries/beneficiaries.service.ts
src/upload/upload.service.ts
src/upload/upload.controller.ts
```

## Responsabilidade

Este fluxo é responsável por:

- armazenar URLs de documentos do aluno;
- validar URLs recebidas nos DTOs;
- registrar aceite LGPD;
- armazenar URL do termo LGPD;
- armazenar URL de foto de perfil;
- armazenar URL de laudo médico;
- armazenar URL de atestado médico;
- remover arquivo antigo quando URL é alterada;
- evitar arquivos órfãos no Cloudinary;
- manter auditoria das alterações documentais.

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- Document URL Storage Pattern;
- Cloudinary Cleanup Pattern;
- LGPD-aware Data Model;
- DTO Validation Pattern;
- Manual Audit Pattern;
- Best-effort External Cleanup;
- Separation of File Upload and Entity Update.

## Justificativa Técnica

O módulo `Beneficiaries` não armazena o binário dos documentos diretamente no registro do aluno. Ele armazena URLs de arquivos previamente enviados para serviço externo de upload.

Essa estratégia reduz peso no banco e separa responsabilidades:

```txt
UploadModule → recebe, valida e envia arquivo
BeneficiariesModule → vincula URL ao aluno
```

Quando a URL muda, o service tenta remover o arquivo antigo para reduzir acúmulo de órfãos.

---

# 3. Campos Documentais

## Campos de Foto e Documentos

| Campo | Objetivo |
|---|---|
| `fotoPerfil` | URL da foto do aluno |
| `laudoUrl` | URL do laudo médico |
| `termoLgpdUrl` | URL do termo LGPD |
| `atestadoUrl` | URL do atestado médico |
| `atestadoEmitidoEm` | Data de emissão do atestado |

## Campos LGPD

| Campo | Objetivo |
|---|---|
| `termoLgpdAceito` | Indica aceite do termo LGPD |
| `termoLgpdAceitoEm` | Data/hora do aceite |
| `termoLgpdUrl` | Arquivo do termo assinado/digitalizado |

## Validações nos DTOs

As URLs usam:

```txt
IsUrl({ require_protocol: false, require_tld: false })
MaxLength(2000)
IsOptional()
```

A validação é permissiva para manter compatibilidade com URLs internas ou Cloudinary.

Campos de data usam:

```txt
IsDateString()
```

---

# 4. Fluxo de Atualização e Limpeza

## Método `update()`

No `BeneficiariesService`, a atualização busca dados atuais com:

```txt
ALUNO_MUTATION_SELECT
```

Esse select contém os campos necessários para cleanup:

- `id`;
- `fotoPerfil`;
- `termoLgpdUrl`;
- `nomeCompleto`.

## Cleanup de Arquivos Antigos

Antes de atualizar o aluno, o service chama:

```txt
deleteFileIfChanged(dadosAtuais.fotoPerfil, dto.fotoPerfil, 'Foto de perfil')
deleteFileIfChanged(dadosAtuais.termoLgpdUrl, dto.termoLgpdUrl, 'Documento LGPD')
```

## Método `deleteFileIfChanged()`

Regras:

- só executa se uma nova URL foi enviada;
- só remove se a URL antiga existe;
- só remove se a nova URL é diferente da antiga;
- chama `uploadService.deleteFile(urlAtual)`;
- se falhar, registra warning;
- falha não bloqueia o update principal.

Essa abordagem é chamada de best-effort cleanup.

---

# 5. Auditoria

Alterações em documentos são auditadas indiretamente pela auditoria de atualização do aluno.

A ação usada é:

```txt
AuditAcao.ATUALIZAR
```

O registro contém:

- `oldValue`: dados anteriores mínimos;
- `newValue`: aluno atualizado;
- autor;
- IP;
- user agent.

Como o controller usa `@SkipAudit()`, a auditoria é manual no service.

---

# 6. Segurança e Qualidade

## Segurança

Pontos fortes:

- URLs têm limite de tamanho;
- DTO valida formato de URL;
- documentos sensíveis são vinculados por URL, não binário no banco;
- uploads documentais são controlados pelo módulo `Upload`;
- alterações são auditadas;
- limpeza de arquivo antigo reduz risco de dados antigos permanecerem expostos.

## Qualidade

Pontos positivos:

- separação entre upload e vínculo cadastral;
- cleanup centralizado em helper privado;
- falha externa não derruba operação principal;
- warnings são registrados para diagnóstico;
- `ALUNO_MUTATION_SELECT` evita carregar entidade completa só para cleanup.

## Performance

- update busca apenas campos necessários;
- remoção de arquivos antigos roda antes da atualização;
- `Promise.all()` executa limpezas de foto e LGPD em paralelo.

---

# 7. Regras de Negócio

- documentos são armazenados como URLs;
- termo LGPD pode ter aceite, data de aceite e URL do documento;
- alteração de foto remove foto antiga quando possível;
- alteração de termo LGPD remove documento antigo quando possível;
- falha ao remover arquivo antigo não impede atualização do aluno;
- mudanças documentais devem ser auditadas.

---

# 8. Pontos de Atenção

## Riscos

- `laudoUrl` e `atestadoUrl` também são campos documentais, mas o cleanup explícito atual cobre `fotoPerfil` e `termoLgpdUrl`.
- Como URL é permissiva, o UploadModule deve continuar controlando origem e tipo de arquivo.
- Falha de deleção Cloudinary pode gerar arquivo órfão.
- Auditoria precisa evitar exposição indevida de dados sensíveis em snapshots.

## Débitos Técnicos

- Avaliar cleanup também para `laudoUrl` e `atestadoUrl` quando forem substituídos.
- Criar política de retenção de documentos LGPD.
- Criar testes para alteração de URLs e cleanup.
- Criar job periódico para identificar órfãos no Cloudinary.
- Restringir URLs a domínios confiáveis, se necessário.

## Melhorias Futuras

- Criar service dedicado para documentos do aluno;
- versionar documentos LGPD;
- armazenar metadados de arquivo, como publicId e tipo;
- substituir URL pura por objeto de arquivo estruturado;
- fila de cleanup com retry;
- relatório administrativo de arquivos órfãos.

---

# 9. Relação com Outros Módulos

| Módulo | Relação |
|---|---|
| `UploadModule` | Envia e remove arquivos |
| `BeneficiariesService` | Vincula URLs ao aluno |
| `AuditLogModule` | Audita alterações documentais |
| `Prisma/Aluno` | Persiste URLs e campos LGPD |
| Frontend | Faz upload e envia URL ao cadastro |
| Cloudinary | Armazena arquivos externos |

---

# 10. Resumo Técnico Final

O fluxo de LGPD, documentos e arquivos do módulo `Beneficiaries` está estruturado de forma profissional, separando upload de vínculo cadastral e aplicando cleanup best-effort para arquivos antigos.

Criticidade: muito alta.

Complexidade: alta.

A principal melhoria recomendada é ampliar o cleanup para todos os campos documentais substituíveis, criar política de retenção LGPD e evoluir URLs simples para metadados estruturados de arquivo.
