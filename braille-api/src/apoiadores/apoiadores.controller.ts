import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseInterceptors, UploadedFile, BadRequestException, UseGuards, Res, Req } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import type { Response } from 'express';
import { ApoiadoresService } from './apoiadores.service';
import { CreateApoiadorDto, UpdateApoiadorDto, CreateAcaoApoiadorDto, UpdateAcaoApoiadorDto } from './dto/apoiador.dto';
import { EmitirCertificadoApoiadorDto } from './dto/emitir-certificado-apoiador.dto';
import { TipoApoiador } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from '../upload/upload.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

export interface AuditUserParams {
  sub: string;
  nome: string;
  role: string;
  ip?: string;
  userAgent?: string;
}

function getAuditUser(req: AuthenticatedRequest): AuditUserParams {
  return {
    sub: req.user?.sub ?? '',
    // @ts-ignore
    nome: req.user?.nome || req.user?.email || 'Desconhecido',
    role: req.user?.role ?? 'USER',
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress,
    userAgent: req.headers['user-agent'],
  };
}

@Controller('apoiadores')
export class ApoiadoresController {
  constructor(
    private readonly apoiadoresService: ApoiadoresService,
    private readonly uploadService: UploadService
  ) {}

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  create(@Body() createApoiadorDto: CreateApoiadorDto, @Req() req: AuthenticatedRequest) {
    return this.apoiadoresService.create(createApoiadorDto, getAuditUser(req));
  }

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
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
      ativo: ativo === undefined ? undefined : ativo !== 'false',
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
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  findOne(@Param('id') id: string) {
    return this.apoiadoresService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  update(@Param('id') id: string, @Body() updateApoiadorDto: UpdateApoiadorDto, @Req() req: AuthenticatedRequest) {
    return this.apoiadoresService.update(id, updateApoiadorDto, getAuditUser(req));
  }

  @Patch(':id/logo')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @Req() req: AuthenticatedRequest) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado.');
    }
    
    // Verifica se apoiador existe antes do upload
    await this.apoiadoresService.findOne(id);
    
    // Upload via UploadService existente no projeto
    const uploaded = await this.uploadService.uploadImage(file, getAuditUser(req));
    
    return this.apoiadoresService.updateLogo(id, uploaded.url, getAuditUser(req));
  }

  @Patch(':id/inativar')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  inativar(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.apoiadoresService.inativar(id, getAuditUser(req));
  }

  @Patch(':id/reativar')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  reativar(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.apoiadoresService.reativar(id, getAuditUser(req));
  }

  // ---- Histórico de Ações (Tracking Relacional) ----
  
  @Post(':id/acoes')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  addAcao(
    @Param('id') id: string, 
    @Body() dto: CreateAcaoApoiadorDto,
    @Req() req: AuthenticatedRequest
  ) {
    return this.apoiadoresService.addAcao(id, dto, getAuditUser(req));
  }

  @Patch(':id/acoes/:acaoId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  updateAcao(
    @Param('id') id: string,
    @Param('acaoId') acaoId: string,
    @Body() dto: UpdateAcaoApoiadorDto,
    @Req() req: AuthenticatedRequest
  ) {
    return this.apoiadoresService.updateAcao(id, acaoId, dto, getAuditUser(req));
  }

  @Get(':id/acoes')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  getAcoes(@Param('id') id: string) {
    return this.apoiadoresService.getAcoes(id);
  }

  @Delete(':id/acoes/:acaoId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  removeAcao(@Param('id') id: string, @Param('acaoId') acaoId: string, @Req() req: AuthenticatedRequest) {
    return this.apoiadoresService.removeAcao(id, acaoId, getAuditUser(req));
  }

  // ---- Certificados da Parte de Honrarias ----

  @Post(':id/certificados')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  emitirCertificado(
    @Param('id') id: string,
    @Body() emitirDto: EmitirCertificadoApoiadorDto,
    @Req() req: AuthenticatedRequest
  ) {
    return this.apoiadoresService.emitirCertificado(id, emitirDto, getAuditUser(req));
  }

  @Get(':id/certificados')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  getCertificados(@Param('id') id: string) {
    return this.apoiadoresService.getCertificados(id);
  }

  @Get(':id/certificados/:certId/pdf')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  async getPdfCertificado(
    @Param('id') id: string,
    @Param('certId') certId: string,
    @Res() res: Response,
  ) {
    const result = await this.apoiadoresService.gerarPdfCertificado(id, certId);

    if (result.type === 'redirect') {
      // ── SSRF Prevention (OWASP A10 / CWE-918) ─────────────────────────────
      // A URL vem do banco de dados — nunca confiar sem validar o host.
      // Apenas redirecionamos para hosts da allowlist conhecida (Cloudinary).
      const REDIRECT_ALLOWLIST = new Set([
        'res.cloudinary.com',
        'api.cloudinary.com',
      ]);

      let redirectHost: string;
      try {
        redirectHost = new URL(result.url).hostname;
      } catch {
        throw new BadRequestException('URL do certificado inválida.');
      }

      if (!REDIRECT_ALLOWLIST.has(redirectHost)) {
        throw new BadRequestException('Destino de redirect não autorizado.');
      }
      // ───────────────────────────────────────────────────────────────────────

      res.redirect(301, result.url);
      return;
    }

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="certificado-${certId}.pdf"`,
      'Content-Length': result.buffer.length,
    });
    res.end(result.buffer);
  }
}

