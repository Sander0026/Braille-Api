import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import * as streamifier from 'streamifier';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UploadService {
  constructor(private configService: ConfigService) {
    // 👇 A configuração do Cloudinary
    cloudinary.config({
      cloud_name: this.configService.get('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get('CLOUDINARY_API_SECRET'),
    });
  }

  uploadImage(file: Express.Multer.File): Promise<{ url: string }> {
    return new Promise((resolve, reject) => {
      // Validação extra de segurança: aceitar imagens e PDFs (Laudos)
      const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];
      if (!allowedMimes.includes(file.mimetype)) {
        return reject(new BadRequestException('Apenas arquivos de imagem ou PDF são permitidos.'));
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'braille_instituicao',
          transformation: [
            { fetch_format: 'auto', quality: 'auto' } // Otimização Cloudinary LCP Permanente (UX/Performance)
          ]
        },
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

  uploadPdf(
    file: Express.Multer.File,
    folder: 'braille_lgpd' | 'braille_atestados',
  ): Promise<{ url: string }> {
    return new Promise((resolve, reject) => {
      if (file.mimetype !== 'application/pdf') {
        return reject(new BadRequestException('Apenas arquivos PDF são permitidos neste endpoint.'));
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'auto', // 'auto' permite visualização pública de PDFs
          use_filename: true,
          unique_filename: true,
        },
        (error, result) => {
          if (error) return reject(error);
          if (!result) return reject(new BadRequestException('Erro desconhecido ao enviar PDF.'));
          resolve({ url: result.secure_url });
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  async deleteFile(fileUrl: string): Promise<{ success: boolean; message: string }> {
    if (!fileUrl) {
      throw new BadRequestException('A URL do arquivo é obrigatória.');
    }

    try {
      // Exemplo de URL: https://res.cloudinary.com/cloud_name/image/upload/v123456789/braille_instituicao/nome_do_arquivo.jpg
      // Precisamos extrair 'braille_instituicao/nome_do_arquivo'
      const urlParts = fileUrl.split('/');
      const filenameWithExtension = urlParts[urlParts.length - 1]; // nome_do_arquivo.jpg
      const folder = urlParts[urlParts.length - 2];                // braille_instituicao

      if (!filenameWithExtension || !folder) {
        throw new BadRequestException('URL do Cloudinary inválida.');
      }

      // Remover a extensão (.jpg, .png, .pdf)
      const filename = filenameWithExtension.split('.')[0];
      const publicId = `${folder}/${filename}`;

      // Determinar o tipo do arquivo (necessário para apagar corretamente)
      const resourceType = fileUrl.toLowerCase().includes('.pdf') ? 'raw' : 'image';

      const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });

      if (result.result !== 'ok' && result.result !== 'not found') {
        throw new Error(`Falha ao excluir no Cloudinary: ${result.result}`);
      }

      return { success: true, message: 'Arquivo excluído com sucesso.' };
    } catch (error) {
      console.error('Erro UploadService.deleteFile:', error);
      throw new BadRequestException('Não foi possível excluir o arquivo na nuvem.');
    }
  }
}