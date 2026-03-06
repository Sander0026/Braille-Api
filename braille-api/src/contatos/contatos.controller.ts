import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ContatosService } from './contatos.service';
import { CreateContatoDto } from './dto/create-contato.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { QueryContatoDto } from './dto/query-contato.dto';

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
  @Roles('ADMIN', 'COMUNICACAO')
  @ApiOperation({ summary: 'Listar mensagens com paginação e filtro por lida/não lida' })
  findAll(@Query() query: QueryContatoDto) {
    return this.contatosService.findAll(query);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Get(':id')
  @Roles('ADMIN', 'COMUNICACAO')
  @ApiOperation({ summary: 'Ver mensagem específica' })
  findOne(@Param('id') id: string) {
    return this.contatosService.findOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Patch(':id/lida')
  @Roles('ADMIN', 'COMUNICACAO')
  @ApiOperation({ summary: 'Marcar mensagem como lida' })
  marcarComoLida(@Param('id') id: string) {
    return this.contatosService.marcarComoLida(id);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Delete(':id')
  @Roles('ADMIN', 'COMUNICACAO')
  @ApiOperation({ summary: 'Excluir mensagem' })
  remove(@Param('id') id: string) {
    return this.contatosService.remove(id);
  }
}