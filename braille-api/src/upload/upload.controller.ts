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
    limits: { fileSize: 10 * 1024 * 1024 }, // Limite de 10MB por arquivo
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