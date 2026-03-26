import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as QRCode from 'qrcode';

/**
 * Converte percentual "top" (origem no canto superior esquerdo, como CSS)
 * para coordenada Y do pdf-lib (origem no canto inferior esquerdo).
 */
function topPctToY(topPct: number, pageHeight: number, elementHeight = 0): number {
  return pageHeight - (topPct / 100) * pageHeight - elementHeight;
}

@Injectable()
export class PdfService {
  /**
   * Constrói o PDF iterando sobre a arte base e substituindo os textos.
   * As coordenadas no layoutConfig seguem o sistema CSS (top/left em %),
   * sendo convertidas para o sistema pdf-lib (origem inferior esquerda).
   */
  async construirPdfBase(
    modelo: any,
    textoFormatado: string,
    codigoValidacao: string,
    nomeAluno?: string,
  ): Promise<Buffer> {
    try {
      const {
        arteBaseUrl, assinaturaUrl, assinaturaUrl2, layoutConfig,
        nomeAssinante, cargoAssinante, nomeAssinante2, cargoAssinante2,
      } = modelo;
      const config = layoutConfig || {};
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // ── 1. Imagem de Fundo ──────────────────────────────────────────────
      const arteRes = await fetch(arteBaseUrl);
      if (!arteRes.ok) throw new Error('Não foi possível acessar a arteBase do Cloudinary.');
      const arteBytes = await arteRes.arrayBuffer();

      let background: any;
      if (arteBaseUrl.toLowerCase().includes('.png')) {
        background = await pdfDoc.embedPng(arteBytes);
      } else {
        background = await pdfDoc.embedJpg(arteBytes);
      }

      const { width, height } = background.scale(1);
      const page = pdfDoc.addPage([width, height]);
      page.drawImage(background, { x: 0, y: 0, width, height });

      // ── 2. Texto do Certificado ─────────────────────────────────────────
      const textConf = config.textoPronto || {};
      const tXPct   = textConf.x   !== undefined ? textConf.x   : 10;
      const tYPct   = textConf.y   !== undefined ? textConf.y   : 20;
      const tX      = (tXPct / 100) * width;
      const tSize   = textConf.fontSize || 32;
      const tMaxW   = textConf.maxWidth ? (textConf.maxWidth / 100) * width : width - tX - 50;
      // Estimativa da altura do bloco de texto para centralizar na conversão Y
      const tY = topPctToY(tYPct, height);

      let r = 0, g = 0, b = 0;
      if (textConf.color) {
        const hex = textConf.color.replace('#', '');
        r = parseInt(hex.substring(0, 2), 16) / 255;
        g = parseInt(hex.substring(2, 4), 16) / 255;
        b = parseInt(hex.substring(4, 6), 16) / 255;
      }

      page.drawText(textoFormatado, {
        x: tX,
        y: tY,
        size: tSize,
        font,
        color: rgb(r, g, b),
        maxWidth: tMaxW,
        lineHeight: tSize * 1.4,
      });

      // ── 3. Tag {{NOME_ALUNO}} posicionável ─────────────────────────────
      if (nomeAluno && config.nomeAluno) {
        const naConf  = config.nomeAluno;
        const naX     = (naConf.x / 100) * width;
        const naSize  = naConf.fontSize || 48;
        const naY     = topPctToY(naConf.y, height);
        let naR = 0, naG = 0, naB = 0;
        if (naConf.color) {
          const hex = naConf.color.replace('#', '');
          naR = parseInt(hex.substring(0, 2), 16) / 255;
          naG = parseInt(hex.substring(2, 4), 16) / 255;
          naB = parseInt(hex.substring(4, 6), 16) / 255;
        }
        page.drawText(nomeAluno, {
          x: naX,
          y: naY,
          size: naSize,
          font: fontBold,
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
          const assH = assinatura.height * (ass1W / assinatura.width);
          // Converte top% para Y pdf-lib (inclui a altura da imagem pra alinhar topo)
          const ass1Y = topPctToY(ass1YTopPct, height, assH);
          const ass1X = (ass1XPct / 100) * width;

          // Fundo branco para eliminar o xadrez de transparência
          page.drawRectangle({
            x: ass1X,
            y: ass1Y,
            width: ass1W,
            height: assH,
            color: rgb(1, 1, 1),
            opacity: 1,
          });
          page.drawImage(assinatura, { x: ass1X, y: ass1Y, width: ass1W, height: assH });

          const textSize = Math.round(tSize * 0.65);
          const cargoSize = Math.round(tSize * 0.52);
          if (nomeAssinante) {
            page.drawText(nomeAssinante, {
              x: ass1X, y: ass1Y - textSize * 1.4,
              size: textSize, font: fontBold, color: rgb(0, 0, 0),
            });
          }
          if (cargoAssinante) {
            page.drawText(cargoAssinante, {
              x: ass1X, y: ass1Y - textSize * 1.4 - cargoSize * 1.4,
              size: cargoSize, font, color: rgb(0.3, 0.3, 0.3),
            });
          }
        }
      }

      if (assinaturaUrl2) {
        const assRes2 = await fetch(assinaturaUrl2);
        if (assRes2.ok) {
          const assBytes2 = await assRes2.arrayBuffer();
          const assinatura2 = await pdfDoc.embedPng(assBytes2);
          const assH2 = assinatura2.height * (ass2W / assinatura2.width);
          const ass2Y = topPctToY(ass2YTopPct, height, assH2);
          const ass2X = (ass2XPct / 100) * width;

          // Fundo branco para eliminar o xadrez de transparência
          page.drawRectangle({
            x: ass2X,
            y: ass2Y,
            width: ass2W,
            height: assH2,
            color: rgb(1, 1, 1),
            opacity: 1,
          });
          page.drawImage(assinatura2, { x: ass2X, y: ass2Y, width: ass2W, height: assH2 });

          const textSize2 = Math.round(tSize * 0.65);
          const cargoSize2 = Math.round(tSize * 0.52);
          if (nomeAssinante2) {
            page.drawText(nomeAssinante2, {
              x: ass2X, y: ass2Y - textSize2 * 1.4,
              size: textSize2, font: fontBold, color: rgb(0, 0, 0),
            });
          }
          if (cargoAssinante2) {
            page.drawText(cargoAssinante2, {
              x: ass2X, y: ass2Y - textSize2 * 1.4 - cargoSize2 * 1.4,
              size: cargoSize2, font, color: rgb(0.3, 0.3, 0.3),
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

      const linkValidacao = `https://instituto-braille.com.br/validar/${codigoValidacao}`;
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
