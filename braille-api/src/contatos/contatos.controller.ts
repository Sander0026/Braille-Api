import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ContatosService } from './contatos.service';
import { CreateContatoDto } from './dto/create-contato.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { QueryContatoDto } from './dto/query-contato.dto';

@ApiTags('Fale Conosco')
@Controller('contatos')
export class ContatosController {
  constructor(private readonly contatosService: ContatosService) { }

  @Post()
  @ApiOperation({ summary: 'Enviar mensagem pelo site (rota pública)' })
  create(@Body() createContatoDto: CreateContatoDto) {
    return this.contatosService.create(createContatoDto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get()
  @ApiOperation({ summary: 'Listar mensagens com paginação e filtro por lida/não lida' })
  findAll(@Query() query: QueryContatoDto) {
    return this.contatosService.findAll(query);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Ver mensagem específica' })
  findOne(@Param('id') id: string) {
    return this.contatosService.findOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Patch(':id/lida')
  @ApiOperation({ summary: 'Marcar mensagem como lida' })
  marcarComoLida(@Param('id') id: string) {
    return this.contatosService.marcarComoLida(id);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Excluir mensagem' })
  remove(@Param('id') id: string) {
    return this.contatosService.remove(id);
  }
}