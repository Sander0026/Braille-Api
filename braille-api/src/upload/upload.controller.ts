import { Controller, Post, Delete, UseInterceptors, UploadedFile, UseGuards, Query, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadService } from './upload.service';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';

@ApiTags('Uploads de Imagens')
@ApiBearerAuth()
@UseGuards(AuthGuard) // 🔒 Só quem está logado pode fazer upload
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) { }

  @Post()
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(), // Mantém o arquivo na memória RAM para enviar ao Cloudinary
    limits: { fileSize: 5 * 1024 * 1024 }, // Limite restrito para 5MB por arquivo
    fileFilter: (_req, file, callback) => {
      // Whitelist explícita de tipos de arquivos
      const allowedMimetypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (allowedMimetypes.includes(file.mimetype) || file.originalname.match(/\.(jpg|jpeg|png|webp|pdf)$/i)) {
        callback(null, true);
      } else {
        callback(new BadRequestException('Tipo de arquivo não suportado. Envie apenas imagens (JPG/PNG) ou PDF.'), false);
      }
    },
  }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo foi enviado. Selecione um arquivo e tente novamente.');
    }
    return this.uploadService.uploadImage(file);
  }

  @Delete()
  async deleteFile(@Query('url') url: string) {
    return this.uploadService.deleteFile(url);
  }
}