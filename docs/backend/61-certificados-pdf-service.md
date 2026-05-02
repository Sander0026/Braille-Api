# 61 — Certificados: PdfService (`src/certificados/pdf.service.ts`)

---

# 1. Visão Geral

O `PdfService` é a engine responsável por montar PDFs de certificados a partir de um modelo visual, texto já formatado, assinaturas, QR Code e código de validação.

Ele usa `pdf-lib` para renderização, `qrcode` para gerar QR Code, `fontkit` para fontes customizadas e `ConfigService` para obter configurações como URL do frontend e diretório de cache de fontes.

Responsabilidades principais:

- criar documento PDF em memória;
- carregar arte base do certificado;
- aplicar texto do certificado;
- renderizar nome do aluno quando aplicável;
- carregar e renderizar assinaturas;
- desenhar linha, nome e cargo do assinante;
- gerar QR Code de validação pública;
- carregar fontes padrão e fontes customizadas;
- cachear fontes em memória e disco;
- validar URLs externas por allowlist;
- evitar SSRF em imagens e fontes;
- retornar `Buffer` final do PDF.

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- PDF Rendering Engine Pattern;
- Template Layout Renderer;
- Resource Allowlist Pattern;
- SSRF Prevention Pattern;
- Font Cache Pattern;
- Coordinate Conversion Pattern;
- QR Code Validation Pattern;
- Defensive Fallback Pattern;
- Single Responsibility Service.

## Justificativa Técnica

A geração de certificados precisa combinar imagem de fundo, texto, fontes, assinaturas e QR Code em posições configuráveis.

Por isso, o `PdfService` foi isolado do `CertificadosService`, mantendo o service de certificados como orquestrador e concentrando os detalhes gráficos em uma engine própria.

---

# 3. Dependências

| Dependência | Uso |
|---|---|
| `pdf-lib` | Criação e desenho do PDF |
| `@pdf-lib/fontkit` | Embutir fontes TTF customizadas |
| `qrcode` | Gerar QR Code de validação |
| `ConfigService` | Ler `FRONTEND_URL` e cache de fontes |
| `fs/path/os` | Cache local de fontes |

---

# 4. Tipo `ModeloPdf`

O tipo `ModeloPdf` define os dados mínimos necessários para montar um PDF.

Campos:

| Campo | Objetivo |
|---|---|
| `arteBaseUrl` | URL da imagem de fundo do certificado |
| `assinaturaUrl` | URL da assinatura principal |
| `assinaturaUrl2` | URL da segunda assinatura, opcional |
| `layoutConfig` | Configuração visual do layout |
| `nomeAssinante` | Nome do assinante principal |
| `cargoAssinante` | Cargo do assinante principal |
| `nomeAssinante2` | Nome do segundo assinante |
| `cargoAssinante2` | Cargo do segundo assinante |

Esse tipo evita uso de `any` no contrato principal da engine.

---

# 5. Configurações

## `frontendUrl`

Obtido por:

```txt
FRONTEND_URL
```

Fallback:

```txt
https://instituto-luizbraille.vercel.app
```

Uso:

```txt
montar link do QR Code de validação pública
```

## `fontCacheDir`

Obtido por:

```txt
CERTIFICADOS_FONT_CACHE_DIR
```

Fallback:

```txt
{tmpdir}/braille-api-font-cache
```

Uso:

```txt
armazenar fontes baixadas para reutilização
```

---

# 6. Catálogo de Fontes

O service mantém um catálogo fixo de fontes permitidas.

Fontes suportadas:

- Roboto;
- Open Sans;
- Montserrat;
- Merriweather;
- Cinzel;
- Playfair Display;
- Great Vibes;
- Parisienne;
- Dancing Script;
- Pacifico.

As fontes são carregadas de URLs estáticas em:

```txt
raw.githubusercontent.com/google/fonts
```

Essa abordagem evita receber URLs arbitrárias do cliente para fontes.

---

# 7. Proteção contra SSRF

## Hosts permitidos para imagens

```txt
res.cloudinary.com
```

## Hosts permitidos para fontes

```txt
raw.githubusercontent.com
```

## Método

```txt
sanitizeSafeUrl(rawUrl, allowedHosts)
```

Valida:

- URL parseável;
- protocolo `http` ou `https`;
- hostname pertence à allowlist;
- subdomínios permitidos conforme regra `hostname === host || hostname.endsWith('.host')`.

## Impacto

Impede que URLs salvas no banco sejam usadas para fazer `fetch` contra redes internas ou hosts maliciosos.

Essa proteção é crítica porque o `PdfService` busca imagens e fontes remotamente.

---

# 8. Sistema de Coordenadas

## Referência Visual

Constantes:

```txt
CANVAS_REF_W = 1122
CANVAS_REF_H = 794
```

Essas dimensões servem como referência do editor visual/frontend.

## Conversão de Y

Função:

```txt
topPctToY(topPct, pageHeight, elementHeight)
```

Objetivo:

Converter coordenada em porcentagem a partir do topo para coordenada PDF a partir da base.

Fórmula:

```txt
y = pageHeight - (topPct / 100) * pageHeight - elementHeight
```

---

# 9. Carregamento de Fontes

## `carregarFonte()`

Fluxo:

1. se fonte ausente ou Helvetica, usa Helvetica;
2. se TimesRoman/Courier, usa fonte padrão;
3. se fonte não está no catálogo, usa Helvetica;
4. registra `fontkit`;
5. tenta cache em memória;
6. tenta fonte local em `assets/fonts` ou cache;
7. baixa fonte de URL segura;
8. rejeita resposta HTML;
9. salva fonte no cache local;
10. embute fonte no PDF;
11. em caso de falha, usa Helvetica.

## Cache de Fontes

O cache existe em dois níveis:

- memória (`Map<string, ArrayBuffer>`);
- disco (`fontCacheDir`).

Benefício:

- evita downloads repetidos;
- melhora performance;
- reduz dependência externa após primeiro uso.

---

# 10. Arte Base

## Método

```txt
adicionarArteBase(pdfDoc, arteBaseUrl)
```

Fluxo:

1. valida URL por allowlist;
2. baixa imagem;
3. detecta PNG por extensão;
4. embute PNG ou JPG;
5. cria página com dimensões da imagem;
6. desenha imagem ocupando toda a página.

Essa imagem é a base visual do certificado.

---

# 11. Corpo do Texto

## Método

```txt
desenharCorpoTexto()
```

Usa configurações de:

```txt
layoutConfig.textoPronto
```

Parâmetros relevantes:

- `x`;
- `y`;
- `maxWidth`;
- `fontSize`;
- `fontFamily`;
- `color`.

O texto já vem formatado do `CertificadosService`, após substituição de tags.

---

# 12. Nome do Aluno

## Método

```txt
desenharNomeAluno()
```

Só executa se:

```txt
nomeAluno foi informado
layoutConfig.nomeAluno existe
```

Usa configurações:

- `x`;
- `y`;
- `fontSize`;
- `fontFamily`;
- `color`;
- `maxWidth`.

Esse método é usado principalmente em certificados acadêmicos.

---

# 13. Assinaturas

## Método

```txt
injetarAssinaturaUrl()
```

Responsável por:

- validar URL da assinatura;
- baixar imagem;
- embutir PNG/JPG;
- calcular escala;
- centralizar imagem no espaço configurado;
- desenhar linha abaixo da assinatura;
- desenhar nome do assinante;
- desenhar cargo do assinante.

## Assinatura principal

Usa:

```txt
layoutConfig.assinatura1
```

## Assinatura secundária

Usa:

```txt
layoutConfig.assinatura2
```

Se houver segunda assinatura, o layout padrão ajusta a posição da primeira para permitir duas assinaturas lado a lado.

---

# 14. QR Code

## Método

```txt
desenharQrCode()
```

Monta link:

```txt
{FRONTEND_URL}/validar-certificado?codigo={codigoValidacao}
```

Gera QR Code com:

- margem 1;
- largura 150;
- cor preta/branca.

Depois embute o PNG gerado no PDF.

Configuração visual:

```txt
layoutConfig.qrCode
```

Campos:

- `x`;
- `y`;
- `size`.

---

# 15. Engine Principal

## Método

```txt
construirPdfBase(modelo, textoFormatado, codigoValidacao, nomeAluno?)
```

Fluxo:

1. extrai dados do modelo;
2. normaliza `layoutConfig`;
3. cria `PDFDocument`;
4. embute fontes base Helvetica/HelveticaBold;
5. adiciona arte base;
6. desenha corpo do texto;
7. desenha nome do aluno se informado;
8. desenha assinatura principal;
9. desenha assinatura secundária se existir;
10. desenha QR Code;
11. salva PDF;
12. retorna `Buffer`.

Em caso de erro, registra log e lança:

```txt
InternalServerErrorException('Problemas críticos ao montar o PDF das partes gráficas.')
```

---

# 16. Segurança e Qualidade

## Segurança

Pontos fortes:

- validação de URL contra SSRF;
- allowlist de hosts para imagens e fontes;
- catálogo fechado de fontes;
- rejeição de protocolos não HTTP/HTTPS;
- dados sensíveis não são necessários na renderização;
- QR Code aponta para frontend configurado.

## Qualidade

Pontos positivos:

- engine isolada;
- helpers pequenos e especializados;
- cache de fontes em memória e disco;
- fallback para Helvetica;
- fallback controlado em falha de fonte;
- coordenadas baseadas em porcentagem facilitam editor visual.

## Performance

- cache de fontes evita downloads repetidos;
- fontes locais são usadas quando disponíveis;
- PDF é gerado em memória;
- apenas recursos necessários são baixados.

---

# 17. Pontos de Atenção

- `sanitizeSafeUrl()` permite `http`; por segurança, poderia aceitar apenas `https`.
- `adicionarArteBase()` detecta PNG por extensão, não por assinatura real.
- `injetarAssinaturaUrl()` retorna silenciosamente se fetch falhar, podendo gerar PDF sem assinatura.
- `layoutConfig` não é validado por schema antes do uso.
- Fontes são baixadas em runtime quando não estão em cache/local.
- `fetch` não define timeout explícito.

---

# 18. Melhorias Futuras

- Restringir recursos externos apenas a HTTPS;
- validar assinatura real de imagens;
- validar `layoutConfig` com schema;
- adicionar timeout em fetch de imagens/fontes;
- registrar erro específico quando assinatura não carregar;
- pré-carregar fontes no startup;
- criar testes de SSRF;
- criar testes de renderização com layoutConfig inválido;
- monitorar tempo de geração de PDF.

---

# 19. Resumo Técnico Final

O `PdfService` é uma engine robusta para montagem de certificados em PDF.

Ele renderiza arte base, texto, nome do aluno, assinaturas e QR Code, usando fontes customizadas e proteção contra SSRF.

Criticidade: muito alta.

Complexidade: muito alta.

A implementação é tecnicamente forte. Os principais próximos passos são validar `layoutConfig`, restringir recursos a HTTPS, adicionar timeout em fetch e criar testes específicos de SSRF e renderização.
