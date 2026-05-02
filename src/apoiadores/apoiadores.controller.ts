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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { ApoiadoresService } from './apoiadores.service';
import { CreateApoiadorDto, UpdateApoiadorDto, CreateAcaoApoiadorDto, UpdateAcaoApoiadorDto } from './dto/apoiador.dto';
import { EmitirCertificadoApoiadorDto } from './dto/emitir-certificado-apoiador.dto';
import { TipoApoiador } from '@prisma/client';
import { UploadService } from '../upload/upload.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { getAuditUser } from '../common/helpers/audit.helper';
import { SkipAudit } from '../common/decorators/skip-audit.decorator';
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
@ApiTags('Apoiadores')
@SkipAudit()
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
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cadastrar novo apoiador' })
  @ApiResponse({ status: 201, description: 'Apoiador criado com sucesso.' })
  @ApiResponse({ status: 400, description: 'Payload inválido.' })
  @ApiResponse({ status: 401, description: 'Token ausente ou expirado.' })
  @ApiResponse({ status: 403, description: 'Role sem permissão (requer ADMIN, COMUNICACAO ou SECRETARIA).' })
  create(@Body() dto: CreateApoiadorDto, @Req() req: AuthenticatedRequest) {
    return this.apoiadoresService.create(dto, getAuditUser(req));
  }

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...GESTAO_ROLES)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Listar apoiadores com filtros e paginação' })
  @ApiQuery({ name: 'skip', required: false, type: Number, description: 'Registros a pular (offset)' })
  @ApiQuery({ name: 'take', required: false, type: Number, description: 'Máximo de registros a retornar' })
  @ApiQuery({ name: 'tipo', required: false, enum: TipoApoiador, description: 'Filtrar por tipo de apoiador' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Busca por nome ou razão social' })
  @ApiQuery({ name: 'ativo', required: false, type: String, description: "Filtrar por status: 'true', 'false' ou 'all'" })
  @ApiResponse({ status: 200, description: 'Lista de apoiadores retornada com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token ausente ou expirado.' })
  @ApiResponse({ status: 403, description: 'Role sem permissão.' })
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
  @ApiOperation({ summary: 'Listar apoiadores visíveis no site público (sem autenticação)' })
  @ApiResponse({ status: 200, description: 'Lista de apoiadores com exibirNoSite=true e ativo=true.' })
  findPublic() {
    return this.apoiadoresService.findPublic();
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...GESTAO_ROLES)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Buscar apoiador por ID' })
  @ApiParam({ name: 'id', description: 'UUID do apoiador', type: String })
  @ApiResponse({ status: 200, description: 'Apoiador encontrado.' })
  @ApiResponse({ status: 401, description: 'Token ausente ou expirado.' })
  @ApiResponse({ status: 403, description: 'Role sem permissão.' })
  @ApiResponse({ status: 404, description: 'Apoiador não encontrado.' })
  findOne(@Param('id') id: string) {
    return this.apoiadoresService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...GESTAO_ROLES)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Atualizar dados do apoiador' })
  @ApiParam({ name: 'id', description: 'UUID do apoiador', type: String })
  @ApiResponse({ status: 200, description: 'Apoiador atualizado com sucesso.' })
  @ApiResponse({ status: 400, description: 'Payload inválido.' })
  @ApiResponse({ status: 401, description: 'Token ausente ou expirado.' })
  @ApiResponse({ status: 403, description: 'Role sem permissão.' })
  @ApiResponse({ status: 404, description: 'Apoiador não encontrado.' })
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
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Fazer upload da logo do apoiador (multipart/form-data, max 10MB)' })
  @ApiParam({ name: 'id', description: 'UUID do apoiador', type: String })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Imagem JPG, PNG ou WebP (max 10MB)' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 200, description: 'Logo atualizada com sucesso. Retorna URL do Cloudinary.' })
  @ApiResponse({ status: 400, description: 'Nenhum arquivo enviado ou tipo inválido.' })
  @ApiResponse({ status: 401, description: 'Token ausente ou expirado.' })
  @ApiResponse({ status: 403, description: 'Role sem permissão.' })
  @ApiResponse({ status: 404, description: 'Apoiador não encontrado.' })
  @ApiResponse({ status: 413, description: 'Arquivo excede o limite de 10MB.' })
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
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Inativar apoiador (exclusão lógica)' })
  @ApiParam({ name: 'id', description: 'UUID do apoiador', type: String })
  @ApiResponse({ status: 200, description: 'Apoiador inativado com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token ausente ou expirado.' })
  @ApiResponse({ status: 403, description: 'Role sem permissão.' })
  @ApiResponse({ status: 404, description: 'Apoiador não encontrado.' })
  inativar(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.apoiadoresService.inativar(id, getAuditUser(req));
  }

  @Patch(':id/reativar')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Reativar apoiador (apenas ADMIN)' })
  @ApiParam({ name: 'id', description: 'UUID do apoiador', type: String })
  @ApiResponse({ status: 200, description: 'Apoiador reativado com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token ausente ou expirado.' })
  @ApiResponse({ status: 403, description: 'Role sem permissão (requer ADMIN).' })
  @ApiResponse({ status: 404, description: 'Apoiador não encontrado.' })
  reativar(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.apoiadoresService.reativar(id, getAuditUser(req));
  }

  // ── Histórico de Ações ──────────────────────────────────────────────────────

  @Post(':id/acoes')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...GESTAO_ROLES)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Registrar ação/evento do apoiador' })
  @ApiParam({ name: 'id', description: 'UUID do apoiador', type: String })
  @ApiResponse({ status: 201, description: 'Ação registrada com sucesso.' })
  @ApiResponse({ status: 400, description: 'Payload inválido.' })
  @ApiResponse({ status: 401, description: 'Token ausente ou expirado.' })
  @ApiResponse({ status: 403, description: 'Role sem permissão.' })
  @ApiResponse({ status: 404, description: 'Apoiador não encontrado.' })
  addAcao(@Param('id') id: string, @Body() dto: CreateAcaoApoiadorDto, @Req() req: AuthenticatedRequest) {
    return this.apoiadoresService.addAcao(id, dto, getAuditUser(req));
  }

  @Patch(':id/acoes/:acaoId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...GESTAO_ROLES)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Atualizar ação do apoiador' })
  @ApiParam({ name: 'id', description: 'UUID do apoiador', type: String })
  @ApiParam({ name: 'acaoId', description: 'UUID da ação', type: String })
  @ApiResponse({ status: 200, description: 'Ação atualizada com sucesso.' })
  @ApiResponse({ status: 400, description: 'Payload inválido.' })
  @ApiResponse({ status: 401, description: 'Token ausente ou expirado.' })
  @ApiResponse({ status: 403, description: 'Role sem permissão.' })
  @ApiResponse({ status: 404, description: 'Ação ou apoiador não encontrado.' })
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
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Listar ações/histórico do apoiador' })
  @ApiParam({ name: 'id', description: 'UUID do apoiador', type: String })
  @ApiResponse({ status: 200, description: 'Lista de ações retornada com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token ausente ou expirado.' })
  @ApiResponse({ status: 403, description: 'Role sem permissão.' })
  @ApiResponse({ status: 404, description: 'Apoiador não encontrado.' })
  getAcoes(@Param('id') id: string) {
    return this.apoiadoresService.getAcoes(id);
  }

  @Delete(':id/acoes/:acaoId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...GESTAO_ROLES)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Remover ação do apoiador' })
  @ApiParam({ name: 'id', description: 'UUID do apoiador', type: String })
  @ApiParam({ name: 'acaoId', description: 'UUID da ação a remover', type: String })
  @ApiResponse({ status: 200, description: 'Ação removida com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token ausente ou expirado.' })
  @ApiResponse({ status: 403, description: 'Role sem permissão.' })
  @ApiResponse({ status: 404, description: 'Ação ou apoiador não encontrado.' })
  removeAcao(@Param('id') id: string, @Param('acaoId') acaoId: string, @Req() req: AuthenticatedRequest) {
    return this.apoiadoresService.removeAcao(id, acaoId, getAuditUser(req));
  }

  // ── Certificados ────────────────────────────────────────────────────────────

  @Post(':id/certificados')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...GESTAO_ROLES)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Emitir certificado de honraria para o apoiador' })
  @ApiParam({ name: 'id', description: 'UUID do apoiador', type: String })
  @ApiQuery({ name: 'incluirPdfBase64', required: false, type: Boolean, description: 'Se true, retorna o PDF em base64 na resposta' })
  @ApiResponse({ status: 201, description: 'Certificado emitido. Retorna URL do PDF no Cloudinary.' })
  @ApiResponse({ status: 400, description: 'Payload inválido ou modelo de certificado não encontrado.' })
  @ApiResponse({ status: 401, description: 'Token ausente ou expirado.' })
  @ApiResponse({ status: 403, description: 'Role sem permissão.' })
  @ApiResponse({ status: 404, description: 'Apoiador não encontrado.' })
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
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Listar certificados emitidos para o apoiador' })
  @ApiParam({ name: 'id', description: 'UUID do apoiador', type: String })
  @ApiResponse({ status: 200, description: 'Lista de certificados retornada.' })
  @ApiResponse({ status: 401, description: 'Token ausente ou expirado.' })
  @ApiResponse({ status: 403, description: 'Role sem permissão.' })
  @ApiResponse({ status: 404, description: 'Apoiador não encontrado.' })
  getCertificados(@Param('id') id: string) {
    return this.apoiadoresService.getCertificados(id);
  }

  @Get(':id/certificados/:certId/pdf')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...GESTAO_ROLES)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Gerar e retornar PDF do certificado (base64)' })
  @ApiParam({ name: 'id', description: 'UUID do apoiador', type: String })
  @ApiParam({ name: 'certId', description: 'UUID do certificado', type: String })
  @ApiResponse({ status: 200, description: 'PDF gerado. Retorna objeto com pdfBase64 e contentType.' })
  @ApiResponse({ status: 401, description: 'Token ausente ou expirado.' })
  @ApiResponse({ status: 403, description: 'Role sem permissão.' })
  @ApiResponse({ status: 404, description: 'Apoiador ou certificado não encontrado.' })
  async getPdfCertificado(@Param('id') id: string, @Param('certId') certId: string) {
    return this.apoiadoresService.gerarPdfCertificado(id, certId);
  }
}

