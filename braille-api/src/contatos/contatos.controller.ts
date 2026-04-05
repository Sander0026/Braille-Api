import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, UseInterceptors, Req } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ContatosService, AuditUserParams } from './contatos.service';
import { CreateContatoDto } from './dto/create-contato.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { QueryContatoDto } from './dto/query-contato.dto';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

function getAuditUser(req: AuthenticatedRequest): AuditUserParams {
  return {
    sub: req.user?.sub ?? '',
    // @ts-ignore - Propriedades existem no token decodificado do auth.guard
    nome: req.user?.nome || req.user?.email || 'Desconhecido',
    role: req.user?.role ?? 'USER',
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress,
    userAgent: req.headers['user-agent'],
  };
}

@ApiTags('Fale Conosco')
@Controller('contatos')
export class ContatosController {
  constructor(private readonly contatosService: ContatosService) { }

  // ── Pública: qualquer visitante pode enviar mensagem ─────────────────────
  @Post()
  @ApiOperation({ summary: 'Enviar mensagem pelo site (rota pública)' })
  create(@Body() createContatoDto: CreateContatoDto) {
    return this.contatosService.create(createContatoDto);
  }

  // ── Rotas autenticadas ────────────────────────────────────────────────────
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  @ApiOperation({ summary: 'Listar mensagens com paginação e filtro por lida/não lida' })
  findAll(@Query() query: QueryContatoDto) {
    return this.contatosService.findAll(query);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Get(':id')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  @ApiOperation({ summary: 'Ver mensagem específica' })
  findOne(@Param('id') id: string) {
    return this.contatosService.findOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Patch(':id/lida')
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  @ApiOperation({ summary: 'Marcar mensagem como lida' })
  marcarComoLida(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.contatosService.marcarComoLida(id, getAuditUser(req));
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Delete(':id')
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  @ApiOperation({ summary: 'Excluir mensagem' })
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.contatosService.remove(id, getAuditUser(req));
  }
}