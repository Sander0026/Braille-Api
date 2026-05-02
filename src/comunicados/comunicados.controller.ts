import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  UsePipes,
  UseInterceptors,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ComunicadosService } from './comunicados.service';
import { CreateComunicadoDto } from './dto/create-comunicado.dto';
import { UpdateComunicadoDto } from './dto/update-comunicado.dto';
import { QueryComunicadoDto } from './dto/query-comunicado.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SanitizeHtmlPipe } from '../common/pipes/sanitize-html.pipe';
import { getAuditUser } from '../common/helpers/audit.helper';
import { SkipAudit } from '../common/decorators/skip-audit.decorator';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@ApiTags('Comunicados (Mural)')
@SkipAudit()
@Controller('comunicados')
export class ComunicadosController {
  constructor(private readonly comunicadosService: ComunicadosService) {}

  // ── Rotas protegidas (requerem JWT válido e perfil de conteúdo) ──────────────

  @Post()
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.COMUNICACAO)
  @UsePipes(new SanitizeHtmlPipe())
  @ApiOperation({ summary: 'Criar um novo comunicado' })
  @ApiResponse({ status: 201, description: 'Comunicado criado com sucesso.' })
  @ApiResponse({ status: 400, description: 'Payload inválido.' })
  @ApiResponse({ status: 401, description: 'Token ausente ou expirado.' })
  @ApiResponse({ status: 403, description: 'Role sem permissão (requer ADMIN ou COMUNICACAO).' })
  create(@Body() dto: CreateComunicadoDto, @Req() req: AuthenticatedRequest) {
    return this.comunicadosService.create(dto, getAuditUser(req));
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.COMUNICACAO)
  @UsePipes(new SanitizeHtmlPipe())
  @ApiOperation({ summary: 'Editar um comunicado' })
  @ApiParam({ name: 'id', description: 'UUID do comunicado' })
  @ApiResponse({ status: 200, description: 'Comunicado atualizado.' })
  @ApiResponse({ status: 400, description: 'Payload inválido.' })
  @ApiResponse({ status: 401, description: 'Token ausente ou expirado.' })
  @ApiResponse({ status: 403, description: 'Role sem permissão.' })
  @ApiResponse({ status: 404, description: 'Comunicado não encontrado.' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateComunicadoDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.comunicadosService.update(id, dto, getAuditUser(req));
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.COMUNICACAO)
  @ApiOperation({ summary: 'Excluir um comunicado' })
  @ApiParam({ name: 'id', description: 'UUID do comunicado' })
  @ApiResponse({ status: 200, description: 'Comunicado excluído.' })
  @ApiResponse({ status: 401, description: 'Token ausente ou expirado.' })
  @ApiResponse({ status: 403, description: 'Role sem permissão.' })
  @ApiResponse({ status: 404, description: 'Comunicado não encontrado.' })
  remove(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: AuthenticatedRequest) {
    return this.comunicadosService.remove(id, getAuditUser(req));
  }

  // ── Rotas públicas (sem autenticação) ────────────────────────────────────────

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60_000)
  @ApiOperation({ summary: 'Listar todos os comunicados (Rota Pública)' })
  @ApiResponse({ status: 200, description: 'Lista de comunicados retornada.' })
  findAll(@Query() query: QueryComunicadoDto) {
    return this.comunicadosService.findAll(query);
  }

  @Get(':id')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60_000)
  @ApiOperation({ summary: 'Obter um comunicado específico pelo ID (Rota Pública)' })
  @ApiParam({ name: 'id', description: 'UUID do comunicado' })
  @ApiResponse({ status: 200, description: 'Comunicado encontrado.' })
  @ApiResponse({ status: 404, description: 'Comunicado não encontrado.' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.comunicadosService.findOne(id);
  }
}
