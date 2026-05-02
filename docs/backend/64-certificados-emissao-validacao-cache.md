# 64 — Certificados: Emissão, Validação Pública e Cache

---

# 1. Visão Geral

Este documento detalha os fluxos mais críticos do módulo `Certificados`:

- emissão acadêmica;
- emissão de honraria;
- cache de certificados acadêmicos já gerados;
- geração de código de validação;
- QR Code;
- validação pública;
- regeneração de certificados;
- armazenamento de PDFs no Cloudinary.

Arquivos relacionados:

```txt
src/certificados/certificados.service.ts
src/certificados/certificados.controller.ts
src/certificados/certificados-publico.controller.ts
src/certificados/pdf.service.ts
src/upload/upload.service.ts
```

---

# 2. Emissão Acadêmica

Endpoint:

```txt
POST /modelos-certificados/emitir-academico
```

Perfis:

```txt
ADMIN
SECRETARIA
PROFESSOR
```

DTO:

```txt
EmitirAcademicoDto
```

Campos:

```txt
turmaId
alunoId
```

---

# 3. Regras da Emissão Acadêmica

Antes de gerar PDF, o service valida:

1. turma existe;
2. aluno possui matrícula na turma;
3. turma ou matrícula está `CONCLUIDA`;
4. turma possui modelo de certificado configurado;
5. frequência mínima é suficiente quando há registros;
6. aluno existe e está acessível para emissão.

## Frequência mínima

Regra:

```txt
mínimo de 75%
```

Presenças consideradas:

- `presente = true`;
- `status = PRESENTE`;
- `status = FALTA_JUSTIFICADA`.

Se não houver registros de frequência, o service não bloqueia emissão.

---

# 4. Cache Hit Acadêmico

Antes de gerar PDF, o service procura:

```txt
CertificadoEmitido where alunoId + turmaId
```

Se encontrar registro com `pdfUrl`, retorna imediatamente:

```txt
pdfUrl
codigoValidacao
```

Sem gerar novo PDF ou fazer novo upload.

Benefícios:

- reduz custo de CPU;
- reduz I/O externo;
- evita duplicidade de certificados;
- melhora tempo de resposta;
- preserva código de validação original.

---

# 5. Public ID Determinístico

PDF acadêmico usa public ID:

```txt
cert-acad-{alunoId}-{turmaId}
```

Enviado para:

```txt
uploadService.uploadPdfBuffer(pdfBuffer, publicId)
```

Pasta padrão:

```txt
braille_certificados
```

Benefícios:

- permite overwrite;
- evita arquivos órfãos;
- facilita regeneração;
- mantém previsibilidade operacional.

---

# 6. Código de Validação

Gerado com:

```txt
randomBytes(4).toString('hex').toUpperCase()
```

Formato:

```txt
8 caracteres hexadecimais em maiúsculo
```

Ponto de atenção:

```txt
A colisão é improvável, mas possível. O service pode evoluir com retry em caso de conflito.
```

---

# 7. Tags Acadêmicas

Tags substituídas:

| Tag | Valor |
|---|---|
| `{{ALUNO}}` | Nome completo do aluno |
| `{{TURMA}}` | Nome da turma |
| `{{CARGA_HORARIA}}` | Carga horária da turma |
| `{{DATA_INICIO}}` | Data inicial formatada pt-BR |
| `{{DATA_FIM}}` | Data final formatada pt-BR |

---

# 8. Emissão de Honraria

Endpoint:

```txt
POST /modelos-certificados/emitir-honraria
```

Perfis:

```txt
ADMIN
SECRETARIA
```

DTO:

```txt
EmitirHonrariaDto
```

Regras:

1. modelo precisa existir;
2. modelo precisa ser do tipo `HONRARIA`;
3. gera código de validação;
4. cria registro `CertificadoEmitido` sem aluno/turma;
5. constrói PDF;
6. retorna PDF direto na resposta.

Tags:

| Tag | Valor |
|---|---|
| `{{PARCEIRO}}` | Nome do parceiro/homenageado |
| `{{MOTIVO}}` | Motivo da homenagem |
| `{{DATA}}` | Data de emissão/evento |

---

# 9. Diferença entre Acadêmico e Honraria

| Aspecto | Acadêmico | Honraria |
|---|---|---|
| Exige aluno | Sim | Não |
| Exige turma | Sim | Não |
| Exige frequência | Sim, quando há dados | Não |
| Usa modelo | Modelo da turma | Modelo informado |
| Armazena PDF | Sim, Cloudinary | Não no fluxo atual |
| Retorno | JSON com `pdfUrl` | PDF direto |
| Validação pública | Por código | Por código |
| Cache hit | Sim | Não |

---

# 10. QR Code

O `PdfService` gera QR Code apontando para:

```txt
{FRONTEND_URL}/validar-certificado?codigo={codigoValidacao}
```

Configuração visual:

```txt
layoutConfig.qrCode
```

Campos:

- `x`;
- `y`;
- `size`.

---

# 11. Validação Pública

Endpoint:

```txt
GET /certificados/validar/:codigo
```

Não exige autenticação.

Usa cache:

```txt
CacheTTL(60000)
```

Antes de consultar o banco, valida:

```txt
codigo.length <= 20
/^[A-Z0-9-]+$/
```

Retorno:

```txt
valido
nome
curso
data
tipo
```

O retorno evita expor CPF, RG, matrícula, dados médicos ou outros dados sensíveis.

---

# 12. Regeneração de Certificados

Método:

```txt
regenerarCertificadosAluno(alunoId)
```

Objetivo:

```txt
Atualizar PDFs acadêmicos quando o nome completo do aluno muda.
```

Características:

- roda em background;
- não bloqueia alteração do aluno;
- reutiliza código de validação;
- usa public ID determinístico;
- falha individual vira warning.

---

# 13. Cache HTTP

Leituras de modelos usam:

```txt
CacheTTL(30000)
```

Validação pública usa:

```txt
CacheTTL(60000)
```

Pontos de atenção:

- alteração de modelo pode não aparecer imediatamente;
- validação pública pode retornar dado antigo durante TTL;
- unidade real do TTL precisa ser confirmada conforme versão do Nest/cache-manager.

---

# 14. Auditoria

Operações auditadas:

| Operação | Entidade | Ação |
|---|---|---|
| Criar modelo | `ModeloCertificado` | `CRIAR` |
| Atualizar modelo | `ModeloCertificado` | `ATUALIZAR` |
| Remover modelo | `ModeloCertificado` | `EXCLUIR` |
| Emitir acadêmico novo | `CertificadoEmitido` | `CRIAR` |
| Emitir honraria | `CertificadoEmitido` | `CRIAR` |

Validação pública não é auditada no fluxo atual.

---

# 15. Pontos de Atenção

- Emissão de honraria cria registro antes de gerar PDF; se PDF falhar, fica emissão sem entrega.
- Honraria não salva `pdfUrl`, diferente do acadêmico.
- Cache HTTP pode ficar defasado após mutações.
- `randomBytes(4)` tem baixo risco de colisão, mas ainda pode exigir retry.
- Frequência sem registros não bloqueia emissão acadêmica.
- Validação pública deveria ter rate limit.

---

# 16. Melhorias Futuras

- Adicionar retry para colisão de código;
- persistir PDF de honraria no Cloudinary;
- adicionar status de emissão;
- adicionar revogação/cancelamento de certificado;
- criar rate limit na validação pública;
- invalidar cache após mutações;
- tornar política de frequência sem registros configurável;
- auditar validação pública se política exigir;
- criar testes de emissão acadêmica e honraria;
- criar testes de QR Code e validação pública.

---

# 17. Resumo Técnico Final

Os fluxos de emissão, validação e cache de certificados são críticos para a confiabilidade institucional do sistema.

A emissão acadêmica possui boas proteções: matrícula, conclusão, frequência, cache hit e PDF persistido. A honraria é mais direta e retorna PDF em memória.

Criticidade: muito alta.

Complexidade: muito alta.
