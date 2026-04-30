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
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.COMUNICACAO)
  @UsePipes(new SanitizeHtmlPipe())
  @ApiOperation({ summary: 'Criar um novo comunicado' })
  create(@Body() dto: CreateComunicadoDto, @Req() req: AuthenticatedRequest) {
    return this.comunicadosService.create(dto, getAuditUser(req));
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.COMUNICACAO)
  @UsePipes(new SanitizeHtmlPipe())
  @ApiOperation({ summary: 'Editar um comunicado' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateComunicadoDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.comunicadosService.update(id, dto, getAuditUser(req));
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.COMUNICACAO)
  @ApiOperation({ summary: 'Excluir um comunicado' })
  remove(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: AuthenticatedRequest) {
    return this.comunicadosService.remove(id, getAuditUser(req));
  }

  // ── Rotas públicas (sem autenticação) ────────────────────────────────────────

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheKey('comunicados:lista')
  @CacheTTL(60_000) // 1 minuto — cache-manager v7 usa milissegundos (antes estava 30ms por engano)
  @ApiOperation({ summary: 'Listar todos os comunicados (Rota Pública)' })
  findAll(@Query() query: QueryComunicadoDto) {
    return this.comunicadosService.findAll(query);
  }

  @Get(':id')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60_000) // 1 minuto — URL do item serve como chave (ex: /api/comunicados/<uuid>)
  @ApiOperation({ summary: 'Obter um comunicado específico pelo ID (Rota Pública)' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.comunicadosService.findOne(id);
  }
}
