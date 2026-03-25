import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PDFDocument, rgb } from 'pdf-lib';
import * as QRCode from 'qrcode';

@Injectable()
export class PdfService {
  /**
   * Constrói o PDF iterando sobre a arte base e substituindo os textos.
   * @param arteBaseUrl URL da imagem de fundo (Cloudinary)
   * @param assinaturaUrl URL da assinatura transparente
   * @param textoFormatado O modelo com as variáveis substituídas (Ex: Nome do Aluno)
   * @param codigoValidacao O Hash único gerado pelo BD
   */
  async construirPdfBase(
    modelo: any,
    textoFormatado: string,
    codigoValidacao: string
  ): Promise<Buffer> {
    try {
      const { arteBaseUrl, assinaturaUrl, assinaturaUrl2, layoutConfig, nomeAssinante, cargoAssinante, nomeAssinante2, cargoAssinante2 } = modelo;
      const config = layoutConfig || {};
      const pdfDoc = await PDFDocument.create();

      // 1. Download nativo da imagem de fundo da API do Cloudinary
      const arteRes = await fetch(arteBaseUrl);
      if (!arteRes.ok) throw new Error('Não foi possível acessar a arteBase do Cloudinary.');
      const arteBytes = await arteRes.arrayBuffer();

      // Transforma a Imagem numa camada nativa
      let background;
      if (arteBaseUrl.toLowerCase().includes('.png')) {
        background = await pdfDoc.embedPng(arteBytes);
      } else {
        background = await pdfDoc.embedJpg(arteBytes);
      }

      // Adiciona uma página de PDF acompanhando as exatas dimensões da imagem (geralmente Paisagem)
      const { width, height } = background.scale(1);
      const page = pdfDoc.addPage([width, height]);

      page.drawImage(background, {
        x: 0,
        y: 0,
        width,
        height,
      });

      // 2. Projeção de Texto (Quebra automática pela Margem)
      const textConf = config.textoPronto || {};
      const tXPct = textConf.x !== undefined ? textConf.x : 10; // default 10%
      const tYPct = textConf.y !== undefined ? textConf.y : 20; // default 20% from top
      const tX = (tXPct / 100) * width;
      const tY = height - ((tYPct / 100) * height);
      
      const tSize = textConf.fontSize || 32;
      
      let r = 0, g = 0, b = 0;
      if (textConf.color) { // Hex #000000
        const hex = textConf.color.replace('#', '');
        r = Number.parseInt(hex.substring(0, 2), 16) / 255;
        g = Number.parseInt(hex.substring(2, 4), 16) / 255;
        b = Number.parseInt(hex.substring(4, 6), 16) / 255;
      }

      page.drawText(textoFormatado, {
        x: tX,
        y: tY, 
        size: tSize,
        color: rgb(r, g, b),
        maxWidth: (textConf.maxWidth ? (textConf.maxWidth / 100) * width : width - 200),
        lineHeight: tSize * 1.25,
      });

      // 3. Projeção da Assinatura PNG e Textos
      const ass1Conf = config.assinatura1 || {};
      const ass1WPct = ass1Conf.width || 20; // default 20%
      const ass1W = (ass1WPct / 100) * width;
      const ass1XPct = ass1Conf.x !== undefined ? ass1Conf.x : (assinaturaUrl2 ? 20 : 40);
      const ass1YPct = ass1Conf.y !== undefined ? ass1Conf.y : 80;
      const ass1X = (ass1XPct / 100) * width;
      const ass1Y = height - ((ass1YPct / 100) * height);

      const ass2Conf = config.assinatura2 || {};
      const ass2W = (ass1WPct / 100) * width; // usa a msm prop da prim pra ficar simétrico ou pega propria
      const ass2XPct = ass2Conf.x !== undefined ? ass2Conf.x : 60;
      const ass2YPct = ass2Conf.y !== undefined ? ass2Conf.y : 80;
      const ass2X = (ass2XPct / 100) * width;
      const ass2Y = height - ((ass2YPct / 100) * height);
      
      if (assinaturaUrl) {
        const assRes = await fetch(assinaturaUrl);
        if (assRes.ok) {
          const assBytes = await assRes.arrayBuffer();
          const assinatura = await pdfDoc.embedPng(assBytes);
          const assHeight = assinatura.height * (ass1W / assinatura.width);

          page.drawImage(assinatura, { x: ass1X, y: ass1Y, width: ass1W, height: assHeight });
          
          if (nomeAssinante) {
            page.drawText(nomeAssinante, { x: ass1X, y: ass1Y - 20, size: 20, color: rgb(0,0,0) });
          }
          if (cargoAssinante) {
            page.drawText(cargoAssinante, { x: ass1X, y: ass1Y - 45, size: 16, color: rgb(0.3,0.3,0.3) });
          }
        }
      } 
      
      if (assinaturaUrl2) {
        const assRes2 = await fetch(assinaturaUrl2);
        if (assRes2.ok) {
          const assBytes2 = await assRes2.arrayBuffer();
          const assinatura2 = await pdfDoc.embedPng(assBytes2);
          const assHeight2 = assinatura2.height * (ass2W / assinatura2.width);

          page.drawImage(assinatura2, { x: ass2X, y: ass2Y, width: ass2W, height: assHeight2 });
          
          if (nomeAssinante2) {
            page.drawText(nomeAssinante2, { x: ass2X, y: ass2Y - 20, size: 20, color: rgb(0,0,0) });
          }
          if (cargoAssinante2) {
            page.drawText(cargoAssinante2, { x: ass2X, y: ass2Y - 45, size: 16, color: rgb(0.3,0.3,0.3) });
          }
        }
      }

      // 4. Projeção do QR Code Unico de Validação
      const qrConf = config.qrCode || {};
      const qrXPct = qrConf.x !== undefined ? qrConf.x : 85;
      const qrYPct = qrConf.y !== undefined ? qrConf.y : 85;
      const qrX = (qrXPct / 100) * width;
      const qrY = height - ((qrYPct / 100) * height);
      const qrW = (10 / 100) * width; // fixed size 10% of page width

      const linkValidacao = `https://instituto-braille.com.br/validar/${codigoValidacao}`;
      
      const qrCodeDataUrl = await QRCode.toDataURL(linkValidacao, { margin: 1, width: 150, color: { dark: '#000', light: '#FFF' } });
      const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, '');
      const qrBytes = Buffer.from(base64Data, 'base64');
      
      const qrImage = await pdfDoc.embedPng(qrBytes);

      // Cola o QRCode na extremidade Inferior Direita
      page.drawImage(qrImage, { x: qrX, y: qrY, width: qrW, height: qrW });

      // Retorna em bytes
      const pdfBytes = await pdfDoc.save();
      return Buffer.from(pdfBytes);
      
    } catch (error) {
      console.error('Falha no Engine PDF:', error);
      throw new InternalServerErrorException('Problemas críticos ao montar o PDF das partes gráficas.');
    }
  }
}
