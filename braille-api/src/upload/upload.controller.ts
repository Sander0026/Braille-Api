import {
  Controller,
  Post,
  Delete,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Query,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadService } from './upload.service';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { getAuditUser } from '../common/helpers/audit.helper';

@ApiTags('Uploads de Arquivos')
@ApiBearerAuth()
@UseGuards(AuthGuard) // 🔒 Só quem está logado pode fazer upload
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB — limite do plano gratuito do Cloudinary
      fileFilter: (_req, file, callback) => {
        const isImage = file.mimetype.startsWith('image/');
        const isPdf = file.mimetype === 'application/pdf';
        if (isImage || isPdf) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException('Tipo de arquivo não suportado. Envie apenas imagens (JPG/PNG/WebP) ou PDF.'),
            false,
          );
        }
      },
    }),
  )
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
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Req() req: AuthenticatedRequest) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo foi enviado. Selecione um arquivo e tente novamente.');
    }
    return this.uploadService.uploadImage(file, getAuditUser(req));
  }

  @Delete()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SECRETARIA)
  async deleteFile(@Query('url') url: string, @Req() req: AuthenticatedRequest) {
    return this.uploadService.deleteFile(url, getAuditUser(req));
  }

  // ─── Upload de PDF (Termo LGPD / Atestado Médico) ──────────────────────────
  @Post('pdf')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB — limite do plano gratuito do Cloudinary
      fileFilter: (_req, file, cb) => {
        const isImage = file.mimetype.startsWith('image/');
        const isPdf = file.mimetype === 'application/pdf';
        if (isPdf || isImage) cb(null, true);
        else cb(new BadRequestException('Envie apenas arquivos PDF ou imagens (JPG/PNG/WebP).'), false);
      },
    }),
  )
  @ApiOperation({ summary: 'Upload de PDF ou Imagem (Laudo Médico / Termo LGPD / Atestado)' })
  @ApiQuery({
    name: 'tipo',
    enum: ['lgpd', 'atestado', 'laudo'],
    required: true,
    description:
      'Tipo do documento: "lgpd" grava em braille_lgpd/, "atestado" em braille_atestados/ e "laudo" em braille_laudos/. Aceita PDF e imagens (JPG/PNG/WebP).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary', description: 'Arquivo PDF ou imagem (JPG/PNG/WebP) — sem limite rígido, Cloudinary otimiza automaticamente' } },
    },
  })
  async uploadPdf(
    @UploadedFile() file: Express.Multer.File,
    @Query('tipo') tipo: 'lgpd' | 'atestado' | 'laudo',
    @Req() req: AuthenticatedRequest,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo foi enviado.');
    if (tipo !== 'lgpd' && tipo !== 'atestado' && tipo !== 'laudo') {
      throw new BadRequestException('O parâmetro "tipo" deve ser "lgpd", "atestado" ou "laudo".');
    }

    let folder: 'braille_lgpd' | 'braille_atestados' | 'braille_laudos';
    if (tipo === 'lgpd') {
      folder = 'braille_lgpd';
    } else if (tipo === 'laudo') {
      folder = 'braille_laudos';
    } else {
      folder = 'braille_atestados';
    }

    return this.uploadService.uploadPdf(file, folder, getAuditUser(req));
  }
}
