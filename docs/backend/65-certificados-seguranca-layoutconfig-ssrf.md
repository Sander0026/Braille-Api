# 65 — Certificados: Segurança, LayoutConfig e SSRF

---

# 1. Visão Geral

Este documento detalha os principais aspectos de segurança do módulo `Certificados`, com foco em:

- proteção contra SSRF na geração de PDF;
- uso de allowlist para imagens e fontes;
- riscos do `layoutConfig`;
- segurança da validação pública;
- cache e consistência;
- arquivos externos no Cloudinary;
- riscos de compensação em fluxos de PDF/arquivo.

Arquivos relacionados:

```txt
src/certificados/pdf.service.ts
src/certificados/certificados.service.ts
src/certificados/certificados.controller.ts
src/certificados/certificados-publico.controller.ts
src/upload/upload.service.ts
```

---

# 2. Contexto de Risco

A geração de certificados envolve recursos externos:

- arte base no Cloudinary;
- assinatura principal no Cloudinary;
- assinatura secundária no Cloudinary;
- fontes TTF remotas;
- QR Code com URL do frontend;
- PDFs salvos no Cloudinary.

Sem proteção adequada, esses recursos poderiam abrir riscos de:

- SSRF;
- carregamento de arquivo externo malicioso;
- uso de host arbitrário;
- layout quebrado;
- PDF incompleto;
- inconsistência entre banco e Cloudinary;
- validação pública abusiva.

---

# 3. SSRF no PdfService

O `PdfService` faz `fetch()` de imagens e fontes para montar o PDF.

Pontos que fazem fetch externo:

- `adicionarArteBase()`;
- `injetarAssinaturaUrl()`;
- `carregarFonte()`.

Para evitar SSRF, o service usa:

```txt
sanitizeSafeUrl(rawUrl, allowedHosts)
```

Essa função valida:

- URL parseável;
- protocolo `http` ou `https`;
- hostname dentro da allowlist;
- subdomínios permitidos do host autorizado.

---

# 4. Allowlist de Hosts

## Imagens

Permitido:

```txt
res.cloudinary.com
```

Impacto:

```txt
Arte base e assinaturas precisam vir do Cloudinary.
```

## Fontes

Permitido:

```txt
raw.githubusercontent.com
```

Impacto:

```txt
Fontes são baixadas apenas do catálogo fixo do Google Fonts no GitHub raw.
```

## Benefício

A allowlist impede URLs como:

```txt
http://localhost:5432
http://169.254.169.254
http://intranet.local
https://dominio-malicioso.com/arquivo.png
```

---

# 5. Protocolo HTTP/HTTPS

A implementação atual permite:

```txt
http
https
```

Ponto de atenção:

```txt
Para produção, o ideal é aceitar apenas https.
```

Motivo:

- evita tráfego sem criptografia;
- reduz risco de interceptação;
- mantém integridade de imagens/fontes.

---

# 6. LayoutConfig

`layoutConfig` é um JSON serializado salvo no modelo de certificado.

Usos principais:

- posição do texto;
- fonte do texto;
- cor do texto;
- largura máxima;
- posição do nome do aluno;
- posição das assinaturas;
- posição/tamanho do QR Code.

Exemplos de chaves usadas:

```txt
textoPronto
nomeAluno
assinatura1
assinatura2
qrCode
```

---

# 7. Risco do LayoutConfig

Hoje, o DTO valida `layoutConfig` apenas como string com tamanho máximo.

O service tenta parsear com:

```txt
JSON.parse(raw)
```

Se falhar:

```txt
registra warning
retorna undefined
```

Ponto de atenção:

```txt
JSON inválido não bloqueia criação/atualização.
```

Riscos:

- layout quebrado;
- PDF gerado com posições padrão inesperadas;
- campos numéricos fora do intervalo;
- fonte inexistente caindo em fallback;
- QR Code fora da área visível;
- texto fora da página.

---

# 8. Validação Recomendada para LayoutConfig

Criar JSON Schema para validar:

- chaves permitidas;
- tipos esperados;
- ranges de `x`, `y`, `width`, `size`;
- tamanho mínimo/máximo de fonte;
- cores em formato hexadecimal;
- fontes dentro do catálogo permitido;
- QR Code dentro da página.

Exemplo de regra recomendada:

```txt
x: 0..100
y: 0..100
fontSize: 1..200
maxWidth: 1..100
color: /^#[0-9A-Fa-f]{6}$/
```

---

# 9. Fontes Customizadas

O catálogo de fontes é fechado.

Isso é positivo porque evita que o usuário informe URL arbitrária de fonte.

Fontes fora do catálogo caem em fallback:

```txt
Helvetica
```

Risco residual:

- download em runtime pode falhar;
- raw.githubusercontent.com pode estar indisponível;
- fonte pode gerar latência;
- sem timeout explícito.

Mitigações atuais:

- cache em memória;
- cache em disco;
- fallback para Helvetica;
- rejeição de HTML como resposta de fonte.

---

# 10. Imagens Externas

Arte base e assinaturas vêm do Cloudinary.

O `PdfService` detecta PNG por extensão:

```txt
url.toLowerCase().endsWith('.png')
```

Caso contrário, usa JPG.

Ponto de atenção:

```txt
A detecção deveria evoluir para assinatura real ou content-type confiável.
```

Riscos:

- extensão incorreta;
- arquivo corrompido;
- PDF gerado sem assinatura se fetch falhar;
- imagem de alta dimensão aumentando uso de memória.

---

# 11. QR Code e FRONTEND_URL

O QR Code aponta para:

```txt
{FRONTEND_URL}/validar-certificado?codigo={codigoValidacao}
```

Fallback atual:

```txt
https://instituto-luizbraille.vercel.app
```

Ponto de atenção:

```txt
FRONTEND_URL precisa ser controlada por ambiente confiável.
```

Se mal configurada, certificados podem apontar para domínio incorreto.

---

# 12. Validação Pública

Endpoint público:

```txt
GET /certificados/validar/:codigo
```

Proteções atuais:

- formato máximo de 20 caracteres;
- regex `^[A-Z0-9-]+$`;
- resposta genérica para inválido/não encontrado;
- retorno com dados mínimos;
- cache de 60 segundos.

Riscos residuais:

- ausência de rate limit específico;
- possibilidade de enumeração por força bruta;
- cache pode retornar dados defasados se futuramente houver revogação.

---

# 13. Cache e Consistência

Rotas cacheadas:

- listagem de modelos;
- detalhe de modelo;
- validação pública.

Pontos de atenção:

- mutações de modelo podem não refletir imediatamente;
- validação pública pode ficar defasada;
- revogação futura exigirá invalidação imediata;
- unidade de `CacheTTL` deve ser confirmada conforme versão do cache-manager.

---

# 14. Arquivos Externos e Compensação

## Troca de arquivos no modelo

O fluxo atual de `trocarArquivo()`:

1. deleta arquivo antigo;
2. faz upload do novo.

Risco:

```txt
Se o upload novo falhar, o arquivo antigo já pode ter sido removido.
```

Melhoria recomendada:

```txt
1. fazer upload novo
2. atualizar banco
3. remover arquivo antigo em background
```

## Remoção de modelo

A remoção usa `Promise.allSettled()` para arquivos externos.

Isso evita que falha no Cloudinary impeça a exclusão do modelo.

Risco:

```txt
arquivos órfãos podem permanecer no Cloudinary
```

---

# 15. Auditoria

Operações de certificado são auditadas manualmente porque o controller usa:

```txt
@SkipAudit()
```

Ponto de atenção:

```txt
Algumas chamadas de auditoria não usam .catch(), então podem impactar a operação principal se falharem.
```

Recomendação:

- auditoria crítica pode bloquear;
- auditoria operacional pode ser best-effort;
- padronizar decisão por tipo de operação.

---

# 16. Riscos e Mitigações

| Risco | Mitigação Atual | Melhoria Recomendada |
|---|---|---|
| SSRF em imagens | Allowlist Cloudinary | HTTPS-only + testes SSRF |
| SSRF em fontes | Catálogo fixo + allowlist GitHub | Pré-empacotar fontes |
| Layout inválido | Fallbacks e warnings | JSON Schema |
| Validação pública abusiva | Regex + cache | Rate limit |
| Código colidir | Random seguro | Retry em colisão |
| PDF sem assinatura | Fetch falho retorna | Erro explícito/alerta |
| Arquivo antigo removido antes | Warning | Upload novo antes do delete |
| Cache defasado | TTL curto | Invalidação explícita |
| MIME/arquivo inválido | Multer MIME | Magic bytes |

---

# 17. Melhorias Futuras

- Exigir HTTPS em `sanitizeSafeUrl()`;
- validar `layoutConfig` com schema;
- adicionar timeout em `fetch`;
- adicionar rate limit na validação pública;
- implementar revogação de certificados;
- invalidar cache após mutações;
- pré-empacotar fontes no deploy;
- testar SSRF com URLs maliciosas;
- validar assinatura real de imagens;
- inverter ordem de troca de arquivos;
- criar job de limpeza de arquivos órfãos.

---

# 18. Resumo Técnico Final

O módulo de certificados possui boas proteções, especialmente a allowlist contra SSRF no `PdfService` e o retorno público com dados mínimos.

Os maiores pontos de atenção estão em `layoutConfig` sem schema, validação pública sem rate limit, cache sem invalidação explícita e compensação de arquivos externos.

Criticidade: muito alta.

Complexidade: muito alta.

As melhorias mais importantes são HTTPS-only, schema de layout, rate limit, invalidação de cache, testes de SSRF e estratégia segura de troca/limpeza de arquivos.
