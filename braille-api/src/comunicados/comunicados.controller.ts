import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, UsePipes, UseInterceptors, Req } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ComunicadosService, AuditUserParams } from './comunicados.service';
import { SanitizeHtmlPipe } from '../common/pipes/sanitize-html.pipe';
import { CreateComunicadoDto } from './dto/create-comunicado.dto';
import { UpdateComunicadoDto } from './dto/update-comunicado.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { QueryComunicadoDto } from './dto/query-comunicado.dto';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

function getAuditUser(req: AuthenticatedRequest): AuditUserParams {
  return {
    sub: req.user?.sub ?? '',
    // @ts-ignore - 'nome' e 'email' existem no payload JWT customizado mas faltam na tipagem base
    nome: req.user?.nome || req.user?.email || 'Desconhecido',
    role: req.user?.role ?? 'USER',
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress,
    userAgent: req.headers['user-agent'],
  };
}

@ApiTags('Comunicados (Mural)')
@Controller('comunicados')
export class ComunicadosController {
  constructor(private readonly comunicadosService: ComunicadosService) { }

  // 👇 ROTA PROTEGIDA (Precisa de login)
  @Post()
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @UsePipes(new SanitizeHtmlPipe())
  @ApiOperation({ summary: 'Criar um novo comunicado' })
  create(@Body() createComunicadoDto: CreateComunicadoDto, @Req() req: AuthenticatedRequest) {
    return this.comunicadosService.create(createComunicadoDto, getAuditUser(req));
  }

  // 👇 ROTA PÚBLICA (Qualquer um pode ver)
  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @ApiOperation({ summary: 'Listar todos os comunicados (Rota Pública)' })
  findAll(@Query() query: QueryComunicadoDto) {
    return this.comunicadosService.findAll(query);
  }

  // 👇 ROTA PÚBLICA (Buscar comunicado específico por ID)
  @Get(':id')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @ApiOperation({ summary: 'Obter um comunicado específico pelo ID (Rota Pública)' })
  findOne(@Param('id') id: string) {
    return this.comunicadosService.findOne(id);
  }

  // 👇 ROTA PROTEGIDA (Precisa de login)
  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @UsePipes(new SanitizeHtmlPipe())
  @ApiOperation({ summary: 'Editar um comunicado' })
  update(@Param('id') id: string, @Body() updateComunicadoDto: UpdateComunicadoDto, @Req() req: AuthenticatedRequest) {
    return this.comunicadosService.update(id, updateComunicadoDto, getAuditUser(req));
  }

  // 👇 ROTA PROTEGIDA (Precisa de login)
  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Excluir um comunicado' })
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.comunicadosService.remove(id, getAuditUser(req));
  }
}