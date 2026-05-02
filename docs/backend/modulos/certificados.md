# Módulo: Certificados

---

# 1. Visão Geral

## Objetivo
Gerenciar templates de certificados (ModeloCertificado) e emissão de certificados em PDF (CertificadoEmitido) com código de validação público via QR Code.

## Responsabilidade
Geração programática de PDFs compondo arte de fundo, texto com variáveis, assinaturas digitalizadas e QR Code de validação — tudo em memória, sem dependência de servidor de renderização externo.

---

# 2. Tipos de Certificado

| Tipo | Destinatário | Emissão |
|---|---|---|
| `ACADEMICO` | Alunos matriculados em turmas | Automática/manual para alunos da turma |
| `HONRARIA` | Apoiadores e parceiros | Manual com dados específicos |

---

# 3. Tags de Template

```
{{ALUNO}}         → Nome do destinatário
{{NOME}}          → Alias de {{ALUNO}}
{{APOIADOR}}      → Alias de {{ALUNO}}
{{PARCEIRO}}      → Alias de {{ALUNO}}
{{NOME_APOIADOR}} → Alias de {{ALUNO}}
{{NOME_EVENTO}}   → Nome do evento/ação
{{MOTIVO}}        → Alias legado de {{NOME_EVENTO}}
{{DATA_EVENTO}}   → Data do evento (DD/MM/AAAA)
{{DATA}}          → Alias legado de {{DATA_EVENTO}}
{{DATA_EMISSAO}}  → Data de emissão (gerada automaticamente)
{{CH}}            → Carga horária da turma
```

---

# 4. Fluxo de Geração de PDF

```
1. Carrega ModeloCertificado (imagem de fundo base64, texto, assinaturas)
2. pdf-lib: cria novo PDF na dimensão da arte base
3. image-processing.service: redimensiona e converte imagens
4. Incorpora arte de fundo como JPG/PNG no PDF
5. Posiciona texto do template (preenchido com vars do aluno)
6. Adiciona assinaturas posicionadas
7. Gera QR Code (URL de validação pública)
8. uploadPdfBuffer() → Cloudinary (pasta braille_certificados)
9. Cria CertificadoEmitido com codigoValidacao único
10. Retorna URL do PDF gerado
```

---

# 5. Endpoints da API

| Método | Rota | Roles | Descrição |
|---|---|---|---|
| `POST` | `/api/modelos-certificados` | `ADMIN` | Criar template |
| `GET` | `/api/modelos-certificados` | Todos | Listar templates |
| `POST` | `/api/certificados/emitir` | `ADMIN, SECRETARIA` | Emitir certificado |
| `POST` | `/api/certificados/emitir-lote/:turmaId` | `ADMIN, SECRETARIA` | Emitir para toda a turma |
| `GET` | `/api/certificados/validar/:codigo` | **Público** | Validar certificado (QR Code) |
| `GET` | `/api/certificados/aluno/:alunoId` | Todos | Certificados emitidos por aluno |

---

# 6. Validação Pública

O endpoint `GET /api/certificados/validar/:codigo` é **público** (sem `AuthGuard`). É a URL embutida no QR Code do certificado físico/digital. Retorna:
- Nome do destinatário
- Tipo e data de emissão
- Nome do evento/turma
- Confirmação de autenticidade

---

# 7. Regeneração por Invalidação de Nome

Quando o nome de um aluno é atualizado (`BeneficiariesService.update()`), os certificados emitidos com o nome antigo são **regenerados automaticamente em background** via `setImmediate()`. O PDF no Cloudinary é sobrescrito (`overwrite: true`) mantendo a mesma URL.

---

# 8. Pontos de Atenção

> [!WARNING]
> **pdf-lib + jimp em Render:** Geração de PDF consome CPU. Em emissão de lote para turmas grandes, pode causar timeout. Considerar fila assíncrona (Bull/BullMQ) no futuro.

> [!NOTE]
> **Código de validação único:** `codigoValidacao` é um UUID gerado na emissão. Não é o ID do banco — pode ser exposto publicamente no QR Code sem expor estrutura interna.

**Criticidade:** 🟡 Importante | **Complexidade:** Alta | **Testes:** `certificados.service.spec.ts`
