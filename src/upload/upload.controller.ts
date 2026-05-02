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
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { getAuditUser } from '../common/helpers/audit.helper';
import { SkipAudit } from '../common/decorators/skip-audit.decorator';

@ApiTags('Uploads de Arquivos')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard) // 🔒 Só quem está logado pode tentar acessar as rotas de upload
@SkipAudit()
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.COMUNICACAO)
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
  @ApiOperation({ summary: 'Upload de imagem/PDF para conteúdo institucional do site' })
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
  @ApiResponse({ status: 201, description: 'Arquivo enviado e URL do Cloudinary retornada.' })
  @ApiResponse({ status: 400, description: 'Nenhum arquivo enviado ou tipo não suportado.' })
  @ApiResponse({ status: 401, description: 'Token ausente ou expirado.' })
  @ApiResponse({ status: 403, description: 'Role sem permissão (requer ADMIN ou COMUNICACAO).' })
  @ApiResponse({ status: 413, description: 'Arquivo excede 10 MB.' })
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Req() req: AuthenticatedRequest) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo foi enviado. Selecione um arquivo e tente novamente.');
    }
    return this.uploadService.uploadImage(file, getAuditUser(req));
  }

  @Delete()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SECRETARIA, Role.COMUNICACAO)
  @ApiOperation({ summary: 'Excluir arquivo do Cloudinary por URL' })
  @ApiQuery({ name: 'url', required: true, description: 'URL pública do arquivo no Cloudinary' })
  @ApiResponse({ status: 200, description: 'Arquivo excluído com sucesso.' })
  @ApiResponse({ status: 400, description: 'URL não informada ou inválida.' })
  @ApiResponse({ status: 401, description: 'Token ausente ou expirado.' })
  async deleteFile(@Query('url') url: string, @Req() req: AuthenticatedRequest) {
    return this.uploadService.deleteFile(url, getAuditUser(req));
  }

  // ─── Upload de PDF (Termo LGPD / Atestado Médico) ──────────────────────────
  @Post('pdf')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SECRETARIA)
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
      properties: { file: { type: 'string', format: 'binary', description: 'Arquivo PDF ou imagem (JPG/PNG/WebP)' } },
    },
  })
  @ApiResponse({ status: 201, description: 'Documento enviado e URL do Cloudinary retornada.' })
  @ApiResponse({ status: 400, description: 'Arquivo ausente, tipo inválido ou parâmetro "tipo" incorreto.' })
  @ApiResponse({ status: 401, description: 'Token ausente ou expirado.' })
  @ApiResponse({ status: 403, description: 'Role sem permissão (requer ADMIN ou SECRETARIA).' })
  @ApiResponse({ status: 413, description: 'Arquivo excede 10 MB.' })
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
