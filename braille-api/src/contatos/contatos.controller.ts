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
  UseInterceptors,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ContatosService } from './contatos.service';
import { CreateContatoDto } from './dto/create-contato.dto';
import { QueryContatoDto } from './dto/query-contato.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { getAuditUser } from '../common/helpers/audit.helper';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@ApiTags('Fale Conosco')
@Controller('contatos')
export class ContatosController {
  constructor(private readonly contatosService: ContatosService) {}

  // ── Pública: qualquer visitante pode enviar mensagem ─────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Enviar mensagem pelo site (rota pública)' })
  @ApiResponse({ status: 201, description: 'Mensagem enviada com sucesso.' })
  @ApiResponse({ status: 400, description: 'Payload inválido.' })
  @ApiResponse({ status: 429, description: 'Muitas requisições — tente novamente em breve.' })
  create(@Body() dto: CreateContatoDto) {
    return this.contatosService.create(dto);
  }

  // ── Rotas autenticadas ────────────────────────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30_000)
  @ApiOperation({ summary: 'Listar mensagens com paginação e filtro por lida/não lida' })
  @ApiResponse({ status: 200, description: 'Lista paginada de mensagens.' })
  @ApiResponse({ status: 401, description: 'Não autenticado.' })
  @ApiResponse({ status: 403, description: 'Sem permissão.' })
  findAll(@Query() query: QueryContatoDto) {
    return this.contatosService.findAll(query);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  @Get(':id')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30_000)
  @ApiOperation({ summary: 'Ver mensagem específica' })
  @ApiParam({ name: 'id', description: 'UUID da mensagem' })
  @ApiResponse({ status: 200, description: 'Mensagem encontrada.' })
  @ApiResponse({ status: 404, description: 'Mensagem não encontrada.' })
  findOne(@Param('id') id: string) {
    return this.contatosService.findOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  @Patch(':id/lida')
  @ApiOperation({ summary: 'Marcar mensagem como lida (idempotente)' })
  @ApiParam({ name: 'id', description: 'UUID da mensagem' })
  @ApiResponse({ status: 200, description: 'Mensagem marcada como lida (ou já estava lida).' })
  @ApiResponse({ status: 404, description: 'Mensagem não encontrada.' })
  marcarComoLida(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.contatosService.marcarComoLida(id, getAuditUser(req));
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  @Delete(':id')
  @ApiOperation({ summary: 'Excluir mensagem' })
  @ApiParam({ name: 'id', description: 'UUID da mensagem' })
  @ApiResponse({ status: 200, description: 'Mensagem excluída com sucesso.' })
  @ApiResponse({ status: 404, description: 'Mensagem não encontrada.' })
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.contatosService.remove(id, getAuditUser(req));
  }
}
