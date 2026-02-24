import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ContatosService } from './contatos.service';
import { CreateContatoDto } from './dto/create-contato.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';

@ApiTags('Fale Conosco')
@Controller('contatos')
export class ContatosController {
  constructor(private readonly contatosService: ContatosService) {}

  @Post() // 🌐 PÚBLICO
  create(@Body() createContatoDto: CreateContatoDto) {
    return this.contatosService.create(createContatoDto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard) // 🔒 PRIVADO
  @Get()
  findAll() {
    return this.contatosService.findAll();
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contatosService.findOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Patch(':id/lida') // Rota específica para marcar como lida
  marcarComoLida(@Param('id') id: string) {
    return this.contatosService.marcarComoLida(id);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contatosService.remove(id);
  }
}