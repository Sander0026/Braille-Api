# 62 — Certificados: ImageProcessingService (`src/certificados/image-processing.service.ts`)

---

# 1. Visão Geral

O `ImageProcessingService` é responsável pelo tratamento de imagens de assinatura utilizadas nos modelos de certificados.

Sua principal função é remover fundo branco ou claro das assinaturas, gerando um PNG com transparência para ser aplicado sobre a arte base do certificado.

Arquivo documentado:

```txt
src/certificados/image-processing.service.ts
```

Responsabilidades principais:

- receber imagem de assinatura em `Buffer`;
- processar pixels com Jimp;
- identificar fundo branco/claro por luminosidade;
- transformar fundo claro em transparência;
- preservar traços escuros da assinatura;
- aplicar suavização de transparência em tons intermediários;
- retornar PNG com canal alpha;
- usar fallback para imagem original em caso de erro.

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- Image Processing Service Pattern;
- Single Responsibility Service;
- Pixel-level Transformation Pattern;
- Defensive Fallback Pattern;
- Non-blocking Visual Enhancement Pattern.

## Justificativa Técnica

Assinaturas geralmente são enviadas como imagens escaneadas ou fotografadas com fundo branco.

Sem processamento, o fundo branco da assinatura ficaria visível sobre a arte do certificado, prejudicando o acabamento visual.

O service resolve esse problema convertendo pixels claros em transparência e mantendo os traços escuros da assinatura.

---

# 3. Dependências

| Dependência | Uso |
|---|---|
| `Jimp` | Leitura e manipulação de imagem em memória |
| `JimpMime` | Exportação do resultado como PNG |
| `Logger` | Registro de falhas no processamento |

---

# 4. Método Principal

## `removerFundoBrancoAssinatura()`

Assinatura:

```txt
removerFundoBrancoAssinatura(inputBuffer: Buffer): Promise<Buffer>
```

Entrada:

```txt
Buffer da imagem original da assinatura
```

Saída:

```txt
Buffer PNG com transparência
```

Fallback:

```txt
Se o processamento falhar, retorna o buffer original.
```

---

# 5. Fluxo Interno

Fluxo do método:

1. carrega a imagem com `Jimp.fromBuffer(inputBuffer)`;
2. define limiares de luminosidade;
3. acessa `img.bitmap.width`, `img.bitmap.height` e `img.bitmap.data`;
4. percorre todos os pixels;
5. calcula luminosidade percebida de cada pixel;
6. se pixel for branco/claro, altera canal alpha;
7. exporta resultado como PNG;
8. retorna novo buffer.

---

# 6. Cálculo de Luminosidade

O service usa a fórmula BT.601:

```txt
luminosidade = 0.299 * r + 0.587 * g + 0.114 * b
```

Essa fórmula aproxima a percepção humana de brilho.

Motivo técnico:

- verde influencia mais a percepção luminosa;
- azul influencia menos;
- cálculo é mais realista do que média simples `(r + g + b) / 3`.

---

# 7. Limiares de Transparência

Constantes internas:

```txt
LIMIAR_OPACO = 190
LIMIAR_BRANCO = 235
```

## Abaixo de 190

Pixels são considerados traços ou áreas escuras.

Resultado:

```txt
mantém alpha original
```

## Entre 190 e 235

Pixels são considerados zona de suavização.

Resultado:

```txt
alpha proporcional
```

Cálculo:

```txt
ratio = (luminosidade - LIMIAR_OPACO) / (LIMIAR_BRANCO - LIMIAR_OPACO)
alpha = 255 * (1 - ratio)
```

## Acima de 235

Pixels são considerados fundo branco.

Resultado:

```txt
alpha = 0
```

Ou seja, ficam totalmente transparentes.

---

# 8. Manipulação do Buffer RGBA

O Jimp expõe os pixels em formato RGBA.

Cada pixel ocupa 4 bytes:

```txt
R
G
B
A
```

Índice calculado:

```txt
idx = (y * width + x) * 4
```

Canais acessados:

```txt
r = data[idx + 0]
g = data[idx + 1]
b = data[idx + 2]
a = data[idx + 3]
```

O service altera apenas:

```txt
data[idx + 3]
```

Ou seja, apenas o canal alpha.

---

# 9. Exportação como PNG

Após processar os pixels, o service exporta com:

```txt
img.getBuffer(JimpMime.png)
```

Motivo:

```txt
PNG preserva transparência via canal alpha.
```

JPG não suportaria transparência, por isso a assinatura processada precisa ser PNG.

---

# 10. Relação com CertificadosService

O `CertificadosService` usa este service no helper:

```txt
uploadAssinatura(file)
```

Fluxo integrado:

1. controller recebe assinatura via multipart;
2. `CertificadosService` chama `ImageProcessingService`;
3. imagem é convertida para PNG transparente;
4. arquivo processado é enviado ao Cloudinary;
5. URL resultante é salva no modelo de certificado.

Campos impactados:

- `assinaturaUrl`;
- `assinaturaUrl2`.

---

# 11. Segurança e Qualidade

## Segurança

Pontos positivos:

- processamento ocorre em memória;
- não grava arquivo temporário local;
- falha não expõe detalhes ao usuário final;
- retorno original evita quebra do fluxo de criação/atualização do modelo.

## Qualidade

Pontos positivos:

- service pequeno e coeso;
- regra visual isolada da regra de negócio;
- fallback seguro;
- PNG final melhora aparência dos certificados;
- algoritmo simples, previsível e fácil de ajustar.

## Performance

- percorre todos os pixels da imagem;
- custo é proporcional à dimensão da assinatura;
- limite de upload de 10 MB reduz risco de imagem excessivamente pesada;
- processamento ocorre apenas quando assinatura é criada/atualizada, não a cada emissão.

---

# 12. Pontos de Atenção

- O algoritmo assume fundo claro/branco; fundos coloridos podem não ser removidos corretamente.
- Assinaturas em tinta muito clara podem ficar parcialmente transparentes.
- Não há redimensionamento antes do processamento.
- Não há validação de dimensão máxima da imagem.
- Em caso de falha, o buffer original é usado, podendo manter fundo branco.
- O serviço não diferencia assinatura fotografada com sombras fortes.

---

# 13. Melhorias Futuras

- Adicionar redimensionamento máximo antes do processamento;
- permitir configuração dos limiares por ambiente ou layout;
- criar pré-visualização da assinatura processada;
- adicionar validação de dimensões máximas;
- aplicar detecção adaptativa de fundo;
- suportar remoção de fundos levemente coloridos;
- registrar métrica de falha de processamento;
- criar testes com imagens de assinatura reais.

---

# 14. Resumo Técnico Final

O `ImageProcessingService` melhora a qualidade visual dos certificados ao remover fundo branco de assinaturas e gerar PNG transparente.

Criticidade: média/alta.

Complexidade: média.

A implementação é simples, eficiente e bem isolada. Os principais pontos de evolução são redimensionamento, validação de dimensão, limiares configuráveis e testes com imagens reais de assinatura.
