import { Injectable, Logger } from '@nestjs/common';
import { Jimp, JimpMime } from 'jimp';

@Injectable()
export class ImageProcessingService {
  private readonly logger = new Logger(ImageProcessingService.name);

  /**
   * Remove o fundo branco/claro de uma imagem de assinatura,
   * tornando os pixels claros transparentes e preservando os traços de tinta.
   * Retorna um Buffer PNG com canal alpha.
   *
   * API: Jimp v1 — usa `Jimp.fromBuffer()` e acesso direto ao `bitmap.data`.
   */
  async removerFundoBrancoAssinatura(inputBuffer: Buffer): Promise<Buffer> {
    try {
      const img = await Jimp.fromBuffer(inputBuffer);

      // Limiar: pixels com luminosidade acima de 235 viram transparentes
      // Zona de suavização: 190-235 recebe transparência proporcional (anti-aliasing)
      const LIMIAR_OPACO = 190; // abaixo disso: mantém tinta totalmente opaca
      const LIMIAR_BRANCO = 235; // acima disso: totalmente transparente

      const { width, height, data } = img.bitmap;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          // Índice do pixel no buffer RGBA (4 bytes por pixel)
          const idx = (y * width + x) * 4;

          const r = data[idx + 0];
          const g = data[idx + 1];
          const b = data[idx + 2];

          // Luminosidade percebida (fórmula BT.601)
          const luminosidade = 0.299 * r + 0.587 * g + 0.114 * b;

          if (luminosidade >= LIMIAR_BRANCO) {
            // Totalmente branco → transparente
            data[idx + 3] = 0;
          } else if (luminosidade >= LIMIAR_OPACO) {
            // Zona de suavização → transparência proporcional
            const ratio = (luminosidade - LIMIAR_OPACO) / (LIMIAR_BRANCO - LIMIAR_OPACO);
            data[idx + 3] = Math.round(255 * (1 - ratio));
          }
          // Abaixo de LIMIAR_OPACO: mantém alpha original (255 = opaco)
        }
      }

      // Jimp v1: toBuffer(mime) retorna Promise<Buffer>
      return Buffer.from(await img.getBuffer(JimpMime.png));
    } catch (err) {
      this.logger.error(`Falha ao remover fundo da assinatura: ${err}. Usando imagem original.`);
      return inputBuffer; // fallback: retorna original sem processar
    }
  }
}
