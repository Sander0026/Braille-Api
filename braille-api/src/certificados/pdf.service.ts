import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts } from 'pdf-lib';
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

const CANVAS_REF_W = 1122;
const CANVAS_REF_H = 794;

@Injectable()
export class PdfService {
  private readonly fontCache = new Map<string, ArrayBuffer>();

  private async carregarFonte(pdfDoc: PDFDocument, fontName?: string): Promise<PDFFont> {
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
        const parsedUrl = new URL(fontUrl);
        if (parsedUrl.protocol !== 'https:') throw new Error('Apenas fontes em HTTPS são permitidas.');
        
        const res = await fetch(parsedUrl.toString());
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ao baixar fonte "${fontName}"`);
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

  private sanitizeSafeUrl(rawUrl: string): string {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('Protocolo inseguro! Evitado ataque SSRF.');
    }
    return parsed.toString();
  }

  private extrairRgb(hexColor?: string): [number, number, number] {
    if (!hexColor) return [0, 0, 0];
    const hex = hexColor.replace('#', '');
    const r = Number.parseInt(hex.substring(0, 2), 16) / 255;
    const g = Number.parseInt(hex.substring(2, 4), 16) / 255;
    const b = Number.parseInt(hex.substring(4, 6), 16) / 255;
    return [r, g, b];
  }

  private async adicionarArteBase(pdfDoc: PDFDocument, arteBaseUrl: string): Promise<{ page: PDFPage; width: number; height: number }> {
    const safeArteUrl = this.sanitizeSafeUrl(arteBaseUrl);
    const arteRes = await fetch(safeArteUrl);
    const arteBytes = await arteRes.arrayBuffer();
    const isPng = arteBaseUrl.toLowerCase().includes('.png');
    const background = isPng ? await pdfDoc.embedPng(arteBytes) : await pdfDoc.embedJpg(arteBytes);
    
    const { width, height } = background.scale(1);
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(background, { x: 0, y: 0, width, height });
    
    return { page, width, height };
  }

  private async desenharCorpoTexto(pdfDoc: PDFDocument, page: PDFPage, width: number, height: number, config: any, textoFormatado: string) {
    const textConf = config.textoPronto || {};
    const tXPct = textConf.x ?? 10;
    const tYPct = textConf.y ?? 20;
    const tX = (tXPct / 100) * width;
    const tMaxW = textConf.maxWidth ? (textConf.maxWidth / 100) * width : width - tX - 50;
    
    const tSize = ((textConf.fontSize || 32) / CANVAS_REF_W) * width;
    const tY = topPctToY(tYPct, height, tSize);
    
    const fontCorpo = await this.carregarFonte(pdfDoc, textConf.fontFamily);
    const [r, g, b] = this.extrairRgb(textConf.color);

    page.drawText(textoFormatado, {
      x: tX, y: tY,
      size: tSize,
      font: fontCorpo,
      color: rgb(r, g, b),
      maxWidth: tMaxW,
      lineHeight: tSize * 1.4,
    });
  }

  private async desenharNomeAluno(pdfDoc: PDFDocument, page: PDFPage, width: number, height: number, config: any, nomeAluno: string) {
    const naConf = config.nomeAluno;
    if (!naConf) return;

    const naX = (naConf.x / 100) * width;
    const naSize = ((naConf.fontSize || 56) / CANVAS_REF_W) * width;
    const naY = topPctToY(naConf.y, height, naSize);
    
    const fontNome = await this.carregarFonte(pdfDoc, naConf.fontFamily);
    const [naR, naG, naB] = this.extrairRgb(naConf.color);

    page.drawText(nomeAluno, {
      x: naX, y: naY,
      size: naSize,
      font: fontNome,
      color: rgb(naR, naG, naB),
      maxWidth: ((naConf.maxWidth || 80) / 100) * width,
    });
  }

  private async injetarAssinaturaUrl(
    pdfDoc: PDFDocument, page: PDFPage, font: PDFFont, fontBold: PDFFont,
    width: number, height: number, signatureUrl: string, overrides: any, isSecondary: boolean
  ) {
    const safeUrl = this.sanitizeSafeUrl(signatureUrl);
    const res = await fetch(safeUrl);
    if (!res.ok) return;

    const imgBytes = await res.arrayBuffer();
    const isPng = safeUrl.toLowerCase().includes('.png');
    const image = isPng ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);

    const conf = overrides.config || {};
    const defaultX = isSecondary ? 60 : (overrides.assinaturaUrl2 ? 20 : 40);
    const wpct = conf.width || (isSecondary ? (overrides.assinatura1?.width || 20) : 20);
    const drawW = (wpct / 100) * width;
    const xpct = conf.x ?? defaultX;
    const yTopPct = conf.y ?? 70;

    const maxSigH = (80 / CANVAS_REF_H) * height;
    const sigGap = (4 / CANVAS_REF_H) * height;
    const sigNmSz = (11 / CANVAS_REF_W) * width;
    const sigCgSz = (9 / CANVAS_REF_W) * width;

    const rawAssH = image.height * (drawW / image.width);
    const finalH = Math.min(rawAssH, maxSigH);
    const finalW = finalH * (image.width / image.height);
    
    const posX = (xpct / 100) * width;
    const imgX = posX + (drawW - finalW) / 2;
    const posY = topPctToY(yTopPct, height, maxSigH);

    page.drawImage(image, { x: imgX, y: posY + (maxSigH - finalH), width: finalW, height: finalH });

    const lineY = posY - sigGap;
    page.drawLine({
      start: { x: posX, y: lineY },
      end: { x: posX + drawW, y: lineY },
      thickness: Math.max(0.5, width * 0.0003),
      color: rgb(0.35, 0.29, 0),
    });

    if (overrides.nome) {
      const nW = fontBold.widthOfTextAtSize(overrides.nome, sigNmSz);
      page.drawText(overrides.nome, {
        x: posX + (drawW - nW) / 2,
        y: lineY - sigNmSz * 1.3,
        size: sigNmSz, font: fontBold, color: rgb(0, 0, 0),
      });
    }
    
    if (overrides.cargo) {
      const cW = font.widthOfTextAtSize(overrides.cargo, sigCgSz);
      page.drawText(overrides.cargo, {
        x: posX + (drawW - cW) / 2,
        y: lineY - sigNmSz * 1.3 - sigCgSz * 1.5,
        size: sigCgSz, font, color: rgb(0.3, 0.3, 0.3),
      });
    }
  }

  private async desenharQrCode(pdfDoc: PDFDocument, page: PDFPage, width: number, height: number, qrConf: any, codigoValidacao: string) {
    const qrXPct = qrConf?.x ?? 85;
    const qrYPct = qrConf?.y ?? 85;
    const qrW = ((qrConf?.size || 10) / 100) * width;
    const qrX = (qrXPct / 100) * width;
    const qrY = topPctToY(qrYPct, height, qrW);

    let baseUrl = process.env.FRONTEND_URL;
    if (!baseUrl) {
      require('dotenv').config();
      baseUrl = process.env.FRONTEND_URL || 'https://instituto-luizbraille.vercel.app';
    }

    const linkValidacao = `${baseUrl}/validar-certificado?codigo=${codigoValidacao}`;
    const qrCodeDataUrl = await QRCode.toDataURL(linkValidacao, { margin: 1, width: 150, color: { dark: '#000', light: '#FFF' } });
    
    const qrBytes = Buffer.from(qrCodeDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
    const qrImage = await pdfDoc.embedPng(qrBytes);
    page.drawImage(qrImage, { x: qrX, y: qrY, width: qrW, height: qrW });
  }

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

      const { page, width, height } = await this.adicionarArteBase(pdfDoc, arteBaseUrl);

      await this.desenharCorpoTexto(pdfDoc, page, width, height, config, textoFormatado);

      if (nomeAluno) {
        await this.desenharNomeAluno(pdfDoc, page, width, height, config, nomeAluno);
      }

      if (assinaturaUrl) {
        await this.injetarAssinaturaUrl(pdfDoc, page, font, fontBold, width, height, assinaturaUrl, {
          config: config.assinatura1, nome: nomeAssinante, cargo: cargoAssinante, assinaturaUrl2, assinatura1: config.assinatura1
        }, false);
      }

      if (assinaturaUrl2) {
        await this.injetarAssinaturaUrl(pdfDoc, page, font, fontBold, width, height, assinaturaUrl2, {
          config: config.assinatura2, nome: nomeAssinante2, cargo: cargoAssinante2, assinaturaUrl2, assinatura1: config.assinatura1
        }, true);
      }

      await this.desenharQrCode(pdfDoc, page, width, height, config.qrCode, codigoValidacao);

      const pdfBytes = await pdfDoc.save();
      return Buffer.from(pdfBytes);

    } catch (error) {
      console.error('Falha no Engine PDF:', error);
      throw new InternalServerErrorException('Problemas críticos ao montar o PDF das partes gráficas.');
    }
  }
}
