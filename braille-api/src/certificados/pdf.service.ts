import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as QRCode from 'qrcode';

// Catálogo de Fontes — URLs estáveis do repositório oficial do Google Fonts (GitHub raw)
const FONTS_URLS: Record<string, string> = {
  // Sans-Serif
  'Roboto':      'https://github.com/googlefonts/roboto/raw/main/src/hinted/Roboto-Regular.ttf',
  'Open Sans':   'https://github.com/googlefonts/opensans/raw/main/fonts/ttf/OpenSans-Regular.ttf',
  'Montserrat':  'https://github.com/JulietaUla/Montserrat/raw/master/fonts/ttf/Montserrat-Regular.ttf',
  // Serif
  'Merriweather':    'https://github.com/SorkinType/Merriweather/raw/master/fonts/Merriweather-Regular.ttf',
  'Cinzel':          'https://github.com/googlefonts/cinzel/raw/main/fonts/ttf/Cinzel-Regular.ttf',
  'Playfair Display':'https://github.com/google/fonts/raw/main/ofl/playfairdisplay/PlayfairDisplay-Regular.ttf',
  // Cursivas elegantes (para Nome do Aluno)
  'Great Vibes':    'https://github.com/google/fonts/raw/main/ofl/greatvibes/GreatVibes-Regular.ttf',
  'Parisienne':     'https://github.com/google/fonts/raw/main/ofl/parisienne/Parisienne-Regular.ttf',
  'Dancing Script': 'https://github.com/google/fonts/raw/main/ofl/dancingscript/DancingScript-Regular.ttf',
  'Pacifico':       'https://github.com/google/fonts/raw/main/ofl/pacifico/Pacifico-Regular.ttf',
};

function topPctToY(topPct: number, pageHeight: number, elementHeight = 0): number {
  return pageHeight - (topPct / 100) * pageHeight - elementHeight;
}

/**
 * Largura de referência do canvas de preview no frontend (px).
 * Usada para converter fontSize (em px relativos ao canvas)
 * para pontos tipográficos reais proporcional à imagem do PDF.
 */
const CANVAS_REF_W = 1122;
/** Altura de referência do canvas de preview (px) — igual ao CANVAS_H do frontend */
const CANVAS_REF_H = 794;

@Injectable()
export class PdfService {
  private readonly fontCache = new Map<string, ArrayBuffer>();

  private async carregarFonte(pdfDoc: PDFDocument, fontName?: string) {
    if (!fontName || fontName === 'Helvetica') return pdfDoc.embedFont(StandardFonts.Helvetica);
    if (fontName === 'TimesRoman') return pdfDoc.embedFont(StandardFonts.TimesRoman);
    if (fontName === 'Courier') return pdfDoc.embedFont(StandardFonts.Courier);

    const fontUrl = FONTS_URLS[fontName];
    if (!fontUrl) {
      console.warn(`[PdfService] Fonte "${fontName}" não encontrada no catálogo. Usando Helvetica.`);
      return pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    try {
      pdfDoc.registerFontkit(fontkit);

      let fontBytes = this.fontCache.get(fontName);
      if (!fontBytes) {
        const res = await fetch(fontUrl);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ao baixar fonte "${fontName}" de ${fontUrl}`);
        }
        const contentType = res.headers.get('content-type') ?? '';
        if (contentType.includes('text/html')) {
          throw new Error(`URL devolveu HTML (não é um .ttf): ${fontUrl}`);
        }
        fontBytes = await res.arrayBuffer();
        this.fontCache.set(fontName, fontBytes);
      }

      return pdfDoc.embedFont(fontBytes);
    } catch (err) {
      console.error(`[PdfService] Falha ao carregar fonte "${fontName}": ${err}. Usando Helvetica como fallback.`);
      return pdfDoc.embedFont(StandardFonts.Helvetica);
    }
  }

  // ... (o resto da função construirPdfBase continua igual até a parte dos textos)

  async construirPdfBase(
    modelo: any,
    textoFormatado: string,
    codigoValidacao: string,
    nomeAluno?: string,
  ): Promise<Buffer> {
    try {
      const { arteBaseUrl, assinaturaUrl, assinaturaUrl2, layoutConfig, nomeAssinante, cargoAssinante, nomeAssinante2, cargoAssinante2 } = modelo;
      const config = layoutConfig || {};
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // (Lógica da Arte Base e Adição da Página mantém-se igual...)
      const arteRes = await fetch(arteBaseUrl);
      const arteBytes = await arteRes.arrayBuffer();
      const background = arteBaseUrl.toLowerCase().includes('.png') ? await pdfDoc.embedPng(arteBytes) : await pdfDoc.embedJpg(arteBytes);
      const { width, height } = background.scale(1);
      const page = pdfDoc.addPage([width, height]);
      page.drawImage(background, { x: 0, y: 0, width, height });

      // ── 2. Texto do Certificado (CORRIGIDO TAMANHO E FONTE) ──
      const textConf = config.textoPronto || {};
      const tXPct   = textConf.x !== undefined ? textConf.x : 10;
      const tYPct   = textConf.y !== undefined ? textConf.y : 20;
      const tX      = (tXPct / 100) * width;
      const tMaxW   = textConf.maxWidth ? (textConf.maxWidth / 100) * width : width - tX - 50;
      // tSize calculado antes de tY para poder usar como offset do baseline
      const tSize   = ((textConf.fontSize || 32) / CANVAS_REF_W) * width;
      // tSize como elementHeight alinha o TOPO do texto com top:Y% do HTML (baseline está abaixo do topo)
      const tY      = topPctToY(tYPct, height, tSize);
      
      
      // Carrega a fonte escolhida pelo usuário
      const fontCorpo = await this.carregarFonte(pdfDoc, textConf.fontFamily);

      // (Lógica de RGB mantém-se igual...)
      let r = 0, g = 0, b = 0;
      if (textConf.color) {
        const hex = textConf.color.replace('#', '');
        r = Number.parseInt(hex.substring(0, 2), 16) / 255;
        g = Number.parseInt(hex.substring(2, 4), 16) / 255;
        b = Number.parseInt(hex.substring(4, 6), 16) / 255;
      }
      page.drawText(textoFormatado, {
        x: tX, y: tY,
        size: tSize, // Aplica direto aqui
        font: fontCorpo,
        color: rgb(r, g, b),
        maxWidth: tMaxW,
        lineHeight: tSize * 1.4,
      });

      // ── 3. Tag {{NOME_ALUNO}} posicionável (CORRIGIDO TAMANHO E FONTE) ──
      if (nomeAluno && config.nomeAluno) {
        const naConf  = config.nomeAluno;
        const naX     = (naConf.x / 100) * width;
        // naSize calculado antes de naY para o offset de baseline
        const naSize  = ((naConf.fontSize || 56) / CANVAS_REF_W) * width;
        // Mesmo ajuste de baseline para nome do aluno (linha única)
        const naY     = topPctToY(naConf.y, height, naSize);
        
       const fontNome = await this.carregarFonte(pdfDoc, naConf.fontFamily);

        let naR = 0, naG = 0, naB = 0;
        if (naConf.color) {
          const hex = naConf.color.replace('#', '');
          naR = Number.parseInt(hex.substring(0, 2), 16) / 255;
          naG = Number.parseInt(hex.substring(2, 4), 16) / 255;
          naB = Number.parseInt(hex.substring(4, 6), 16) / 255;
        }

        page.drawText(nomeAluno, {
          x: naX, y: naY,
          size: naSize, // Aplica direto aqui
          font: fontNome,
          color: rgb(naR, naG, naB),
          maxWidth: ((naConf.maxWidth || 80) / 100) * width,
        });
      }

      // ── 4. Assinaturas ─────────────────────────────────────────────────
      const ass1Conf = config.assinatura1 || {};
      const ass1WPct = ass1Conf.width || 20;
      const ass1W    = (ass1WPct / 100) * width;
      const ass1XPct = ass1Conf.x !== undefined ? ass1Conf.x : (assinaturaUrl2 ? 20 : 40);
      const ass1YTopPct = ass1Conf.y !== undefined ? ass1Conf.y : 70;

      const ass2Conf = config.assinatura2 || {};
      const ass2WPct = ass2Conf.width || ass1WPct;
      const ass2W    = (ass2WPct / 100) * width;
      const ass2XPct = ass2Conf.x !== undefined ? ass2Conf.x : 60;
      const ass2YTopPct = ass2Conf.y !== undefined ? ass2Conf.y : 70;

      if (assinaturaUrl) {
        const assRes = await fetch(assinaturaUrl);
        if (assRes.ok) {
          const assBytes = await assRes.arrayBuffer();
          const assinatura = await pdfDoc.embedPng(assBytes);

          // Métricas proporcionais ao canvas de referência — espelham o HTML do preview
          // max-height: 80px no canvas de 794px equiv. a 10.08% da altura da página
          const maxSigH1 = (80  / CANVAS_REF_H) * height;
          const sigGap1  = (4   / CANVAS_REF_H) * height;  // margin-top: 4px do div
          const sigNmSz1 = (11  / CANVAS_REF_W) * width;   // font-size: 11px do <strong>
          const sigCgSz1 = (9   / CANVAS_REF_W) * width;   // font-size: 9px  do <span>

          // Altura real da imagem respeitando a proporção e o teto máximo
          const rawAssH1 = assinatura.height * (ass1W / assinatura.width);
          const assH1    = Math.min(rawAssH1, maxSigH1);
          // Largura ajustada se a altura foi limitada (mantém aspect-ratio)
          const assW1    = assH1 * (assinatura.width / assinatura.height);
          // Centraliza a imagem dentro do container de largura ass1W
          const ass1X   = (ass1XPct / 100) * width;
          const imgX1   = ass1X + (ass1W - assW1) / 2;

          const ass1Y = topPctToY(ass1YTopPct, height, maxSigH1); // reserva a altura máxima
          page.drawImage(assinatura, { x: imgX1, y: ass1Y + (maxSigH1 - assH1), width: assW1, height: assH1 });

          // Linha separadora (border-top equivalente)
          const lineY1 = ass1Y - sigGap1;
          page.drawLine({
            start: { x: ass1X,         y: lineY1 },
            end:   { x: ass1X + ass1W, y: lineY1 },
            thickness: Math.max(0.5, width * 0.0003),
            color: rgb(0.35, 0.29, 0.0),
          });

          // Nome do assinante (centralizado)
          if (nomeAssinante) {
            const nW = fontBold.widthOfTextAtSize(nomeAssinante, sigNmSz1);
            page.drawText(nomeAssinante, {
              x: ass1X + (ass1W - nW) / 2,
              y: lineY1 - sigNmSz1 * 1.3,
              size: sigNmSz1, font: fontBold, color: rgb(0, 0, 0),
            });
          }
          // Cargo (centralizado, menor e mais claro)
          if (cargoAssinante) {
            const cW = font.widthOfTextAtSize(cargoAssinante, sigCgSz1);
            page.drawText(cargoAssinante, {
              x: ass1X + (ass1W - cW) / 2,
              y: lineY1 - sigNmSz1 * 1.3 - sigCgSz1 * 1.5,
              size: sigCgSz1, font, color: rgb(0.3, 0.3, 0.3),
            });
          }
        }
      }

      if (assinaturaUrl2) {
        const assRes2 = await fetch(assinaturaUrl2);
        if (assRes2.ok) {
          const assBytes2 = await assRes2.arrayBuffer();
          const assinatura2 = await pdfDoc.embedPng(assBytes2);

          const maxSigH2 = (80  / CANVAS_REF_H) * height;
          const sigGap2   = (4  / CANVAS_REF_H) * height;
          const sigNmSz2  = (11 / CANVAS_REF_W) * width;
          const sigCgSz2  = (9  / CANVAS_REF_W) * width;

          const rawAssH2 = assinatura2.height * (ass2W / assinatura2.width);
          const assH2    = Math.min(rawAssH2, maxSigH2);
          const assW2    = assH2 * (assinatura2.width / assinatura2.height);
          const ass2X   = (ass2XPct / 100) * width;
          const imgX2   = ass2X + (ass2W - assW2) / 2;

          const ass2Y = topPctToY(ass2YTopPct, height, maxSigH2);
          page.drawImage(assinatura2, { x: imgX2, y: ass2Y + (maxSigH2 - assH2), width: assW2, height: assH2 });

          const lineY2 = ass2Y - sigGap2;
          page.drawLine({
            start: { x: ass2X,         y: lineY2 },
            end:   { x: ass2X + ass2W, y: lineY2 },
            thickness: Math.max(0.5, width * 0.0003),
            color: rgb(0.35, 0.29, 0.0),
          });

          if (nomeAssinante2) {
            const nW2 = fontBold.widthOfTextAtSize(nomeAssinante2, sigNmSz2);
            page.drawText(nomeAssinante2, {
              x: ass2X + (ass2W - nW2) / 2,
              y: lineY2 - sigNmSz2 * 1.3,
              size: sigNmSz2, font: fontBold, color: rgb(0, 0, 0),
            });
          }
          if (cargoAssinante2) {
            const cW2 = font.widthOfTextAtSize(cargoAssinante2, sigCgSz2);
            page.drawText(cargoAssinante2, {
              x: ass2X + (ass2W - cW2) / 2,
              y: lineY2 - sigNmSz2 * 1.3 - sigCgSz2 * 1.5,
              size: sigCgSz2, font, color: rgb(0.3, 0.3, 0.3),
            });
          }
        }
      }

      // ── 5. QR Code ─────────────────────────────────────────────────────
      const qrConf = config.qrCode || {};
      const qrXPct = qrConf.x !== undefined ? qrConf.x : 85;
      const qrYPct = qrConf.y !== undefined ? qrConf.y : 85;
      const qrW    = ((qrConf.size || 10) / 100) * width;
      const qrX    = (qrXPct / 100) * width;
      const qrY    = topPctToY(qrYPct, height, qrW);

      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
      const linkValidacao = `${baseUrl}/validar-certificado?codigo=${codigoValidacao}`;
      const qrCodeDataUrl = await QRCode.toDataURL(linkValidacao, {
        margin: 1, width: 150, color: { dark: '#000', light: '#FFF' },
      });
      const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, '');
      const qrBytes    = Buffer.from(base64Data, 'base64');
      const qrImage    = await pdfDoc.embedPng(qrBytes);
      page.drawImage(qrImage, { x: qrX, y: qrY, width: qrW, height: qrW });

      // ── Exportar ────────────────────────────────────────────────────────
      const pdfBytes = await pdfDoc.save();
      return Buffer.from(pdfBytes);

    } catch (error) {
      console.error('Falha no Engine PDF:', error);
      throw new InternalServerErrorException('Problemas críticos ao montar o PDF das partes gráficas.');
    }
  }
}
