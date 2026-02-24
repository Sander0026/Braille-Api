import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import * as streamifier from 'streamifier';

@Injectable()
export class UploadService {
  constructor() {
    // 👇 A configuração do Cloudinary (vamos colocar as chaves no .env depois)
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  uploadImage(file: Express.Multer.File): Promise<{ url: string }> {
    return new Promise((resolve, reject) => {
      // Validação extra de segurança: só aceitar imagens
      if (!file.mimetype.startsWith('image/')) {
        return reject(new BadRequestException('Apenas arquivos de imagem são permitidos.'));
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'braille_instituicao' }, 
        (error, result) => {
          if (error) return reject(error);
          
          if (!result) return reject(new BadRequestException('Erro desconhecido ao enviar imagem.'));

          resolve({ url: result.secure_url }); // Agora o TS sabe que o result existe 100%!
        },
      );

      // Pega o arquivo da memória do servidor e joga para o Cloudinary
      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }
}