import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
  Res,
  Req,
} from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { ApoiadoresService } from './apoiadores.service';
import { CreateApoiadorDto, UpdateApoiadorDto, CreateAcaoApoiadorDto, UpdateAcaoApoiadorDto } from './dto/apoiador.dto';
import { EmitirCertificadoApoiadorDto } from './dto/emitir-certificado-apoiador.dto';
import { TipoApoiador } from '@prisma/client';
import { UploadService } from '../upload/upload.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { getAuditUser } from '../common/helpers/audit.helper';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

// ── Constante de Roles ─────────────────────────────────────────────────────────
/** Roles com acesso à gestão de apoiadores — evita repetição em cada rota. */
const GESTAO_ROLES = ['ADMIN', 'COMUNICACAO', 'SECRETARIA'] as const;
const CLOUDINARY_MAX_FILE_SIZE = 10 * 1024 * 1024;

// ── Controller ─────────────────────────────────────────────────────────────────

/**
 * Controller extremamente magro: apenas roteamento HTTP e orquestração de chamadas.
 * Toda a lógica de negócio, SSRF prevention e auditoria está no ApoiadoresService.
 *
 * Importa getAuditUser de common/helpers (única fonte de verdade — sem duplicação).
 */
@Controller('apoiadores')
export class ApoiadoresController {
  constructor(
    private readonly apoiadoresService: ApoiadoresService,
    private readonly uploadService: UploadService,
  ) {}

  // ── CRUD Principal ──────────────────────────────────────────────────────────

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...GESTAO_ROLES)
  create(@Body() dto: CreateApoiadorDto, @Req() req: AuthenticatedRequest) {
    return this.apoiadoresService.create(dto, getAuditUser(req));
  }

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...GESTAO_ROLES)
  findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('tipo') tipo?: TipoApoiador,
    @Query('search') search?: string,
    @Query('ativo') ativo?: string,
  ) {
    return this.apoiadoresService.findAll({
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
      tipo,
      search,
      ativo: ativo === undefined || ativo === 'all' ? undefined : ativo !== 'false',
    });
  }

  @Get('publicos')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  findPublic() {
    return this.apoiadoresService.findPublic();
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...GESTAO_ROLES)
  findOne(@Param('id') id: string) {
    return this.apoiadoresService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...GESTAO_ROLES)
  update(@Param('id') id: string, @Body() dto: UpdateApoiadorDto, @Req() req: AuthenticatedRequest) {
    return this.apoiadoresService.update(id, dto, getAuditUser(req));
  }

  /**
   * Upload de logo: valida existência (findOne), faz upload e atualiza URL.
   * Chamadas em sequência intencional — upload só deve ocorrer se o apoiador existir.
   */
  @Patch(':id/logo')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...GESTAO_ROLES)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: CLOUDINARY_MAX_FILE_SIZE },
      fileFilter: (_req, file, callback) => {
        const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
        if (isImage) {
          callback(null, true);
          return;
        }

        callback(
          new BadRequestException('Tipo de arquivo não suportado. Envie apenas imagens JPG, PNG ou WebP.'),
          false,
        );
      },
    }),
  )
  async uploadLogo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado.');

    const auditUser = getAuditUser(req);

    await this.apoiadoresService.findOne(id);
    const uploaded = await this.uploadService.uploadImage(file, auditUser);

    return this.apoiadoresService.updateLogo(id, uploaded.url, auditUser);
  }

  @Patch(':id/inativar')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...GESTAO_ROLES)
  inativar(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.apoiadoresService.inativar(id, getAuditUser(req));
  }

  @Patch(':id/reativar')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  reativar(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.apoiadoresService.reativar(id, getAuditUser(req));
  }

  // ── Histórico de Ações ──────────────────────────────────────────────────────

  @Post(':id/acoes')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...GESTAO_ROLES)
  addAcao(@Param('id') id: string, @Body() dto: CreateAcaoApoiadorDto, @Req() req: AuthenticatedRequest) {
    return this.apoiadoresService.addAcao(id, dto, getAuditUser(req));
  }

  @Patch(':id/acoes/:acaoId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...GESTAO_ROLES)
  updateAcao(
    @Param('id') id: string,
    @Param('acaoId') acaoId: string,
    @Body() dto: UpdateAcaoApoiadorDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.apoiadoresService.updateAcao(id, acaoId, dto, getAuditUser(req));
  }

  @Get(':id/acoes')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...GESTAO_ROLES)
  getAcoes(@Param('id') id: string) {
    return this.apoiadoresService.getAcoes(id);
  }

  @Delete(':id/acoes/:acaoId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...GESTAO_ROLES)
  removeAcao(@Param('id') id: string, @Param('acaoId') acaoId: string, @Req() req: AuthenticatedRequest) {
    return this.apoiadoresService.removeAcao(id, acaoId, getAuditUser(req));
  }

  // ── Certificados ────────────────────────────────────────────────────────────

  @Post(':id/certificados')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...GESTAO_ROLES)
  emitirCertificado(
    @Param('id') id: string,
    @Body() dto: EmitirCertificadoApoiadorDto,
    @Query('incluirPdfBase64') incluirPdfBase64: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.apoiadoresService.emitirCertificado(id, dto, getAuditUser(req), {
      incluirPdfBase64: incluirPdfBase64 === 'true',
    });
  }

  @Get(':id/certificados')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...GESTAO_ROLES)
  getCertificados(@Param('id') id: string) {
    return this.apoiadoresService.getCertificados(id);
  }

  @Get(':id/certificados/:certId/pdf')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...GESTAO_ROLES)
  async getPdfCertificado(@Param('id') id: string, @Param('certId') certId: string) {
    return this.apoiadoresService.gerarPdfCertificado(id, certId);
  }
}
