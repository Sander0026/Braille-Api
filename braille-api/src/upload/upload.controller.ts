import { Controller, Post, Delete, UseInterceptors, UploadedFile, UseGuards, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
  @UseInterceptors(FileInterceptor('file')) // O campo do formulário deve se chamar "file"
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
    return this.uploadService.uploadImage(file);
  }

  @Delete()
  async deleteFile(@Query('url') url: string) {
    return this.uploadService.deleteFile(url);
  }
}