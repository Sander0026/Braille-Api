import { Injectable, Logger } from '@nestjs/common';
import Jimp from 'jimp';

@Injectable()
export class ImageProcessingService {
  private readonly logger = new Logger(ImageProcessingService.name);

  /**
   * Remove o fundo branco/claro de uma imagem de assinatura,
   * tornando os pixels claros transparentes e preservando os traços de tinta.
   * Retorna um Buffer PNG com canal alpha.
   */
  async removerFundoBrancoAssinatura(inputBuffer: Buffer): Promise<Buffer> {
    try {
      const img = await Jimp.read(inputBuffer);

      // Limiar: pixels com luminosidade acima de 220/255 viram transparentes
      // Zona de suavização: 190-220 recebe transparência proporcional (anti-aliasing)
      const LIMIAR_OPACO = 190;   // abaixo disso: mantém tinta totalmente opaca
      const LIMIAR_BRANCO = 235;  // acima disso: totalmente transparente

      img.scan(0, 0, img.bitmap.width, img.bitmap.height, function (x, y, idx) {
        const r = this.bitmap.data[idx + 0];
        const g = this.bitmap.data[idx + 1];
        const b = this.bitmap.data[idx + 2];

        // Luminosidade percebida (fórmula BT.601)
        const luminosidade = 0.299 * r + 0.587 * g + 0.114 * b;

        if (luminosidade >= LIMIAR_BRANCO) {
          // Totalmente branco → transparente
          this.bitmap.data[idx + 3] = 0;
        } else if (luminosidade >= LIMIAR_OPACO) {
          // Zona de suavização → transparência proporcional
          const ratio = (luminosidade - LIMIAR_OPACO) / (LIMIAR_BRANCO - LIMIAR_OPACO);
          this.bitmap.data[idx + 3] = Math.round(255 * (1 - ratio));
        }
        // Abaixo de LIMIAR_OPACO: mantém alpha original (255 = opaco)
      });

      return img.getBufferAsync(Jimp.MIME_PNG) as unknown as Promise<Buffer>;
    } catch (err) {
      this.logger.error(`Falha ao remover fundo da assinatura: ${err}. Usando imagem original.`);
      return inputBuffer; // fallback: retorna original sem processar
    }
  }
}
