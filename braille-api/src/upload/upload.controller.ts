import { Controller, Post, Delete, UseInterceptors, UploadedFile, UseGuards, Query, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadService } from './upload.service';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';

@ApiTags('Uploads de Arquivos')
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
      if (allowedMimetypes.includes(file.mimetype) || /\.(jpg|jpeg|png|webp|pdf)$/i.exec(file.originalname)) {
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

  // ─── Upload de PDF (Termo LGPD / Atestado Médico) ──────────────────────────
  @Post('pdf')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (_req, file, cb) => {
      if (file.mimetype === 'application/pdf') cb(null, true);
      else cb(new BadRequestException('Apenas arquivos PDF são aceitos.'), false);
    },
  }))
  @ApiOperation({ summary: 'Upload de PDF (Termo LGPD ou Atestado Médico)' })
  @ApiQuery({
    name: 'tipo',
    enum: ['lgpd', 'atestado'],
    required: true,
    description: 'Tipo do documento: "lgpd" grava em braille_lgpd/ e "atestado" em braille_atestados/',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary', description: 'Arquivo PDF (≤ 10 MB)' } },
    },
  })
  async uploadPdf(
    @UploadedFile() file: Express.Multer.File,
    @Query('tipo') tipo: 'lgpd' | 'atestado',
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo PDF foi enviado.');
    if (tipo !== 'lgpd' && tipo !== 'atestado') {
      throw new BadRequestException('O parâmetro "tipo" deve ser "lgpd" ou "atestado".');
    }
    const folder = tipo === 'lgpd' ? 'braille_lgpd' : 'braille_atestados';
    return this.uploadService.uploadPdf(file, folder);
  }
}