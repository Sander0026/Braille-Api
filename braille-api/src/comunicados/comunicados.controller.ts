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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ComunicadosService } from './comunicados.service';
import { CreateComunicadoDto } from './dto/create-comunicado.dto';
import { UpdateComunicadoDto } from './dto/update-comunicado.dto';
import { QueryComunicadoDto } from './dto/query-comunicado.dto';
import { AuthGuard } from '../auth/auth.guard';
import { SanitizeHtmlPipe } from '../common/pipes/sanitize-html.pipe';
import { getAuditUser } from '../common/helpers/audit.helper';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@ApiTags('Comunicados (Mural)')
@Controller('comunicados')
export class ComunicadosController {
  constructor(private readonly comunicadosService: ComunicadosService) {}

  // ── Rotas protegidas (requerem JWT válido) ───────────────────────────────────

  @Post()
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @UsePipes(new SanitizeHtmlPipe())
  @ApiOperation({ summary: 'Criar um novo comunicado' })
  create(@Body() dto: CreateComunicadoDto, @Req() req: AuthenticatedRequest) {
    return this.comunicadosService.create(dto, getAuditUser(req));
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
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
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Excluir um comunicado' })
  remove(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: AuthenticatedRequest) {
    return this.comunicadosService.remove(id, getAuditUser(req));
  }

  // ── Rotas públicas (sem autenticação) ────────────────────────────────────────

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30) // 30 segundos — cache-manager v7 interpreta em segundos
  @ApiOperation({ summary: 'Listar todos os comunicados (Rota Pública)' })
  findAll(@Query() query: QueryComunicadoDto) {
    return this.comunicadosService.findAll(query);
  }

  @Get(':id')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30) // 30 segundos
  @ApiOperation({ summary: 'Obter um comunicado específico pelo ID (Rota Pública)' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.comunicadosService.findOne(id);
  }
}