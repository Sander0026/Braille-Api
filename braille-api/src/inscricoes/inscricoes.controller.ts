import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { InscricoesService } from './inscricoes.service';
import { CreateInscricaoDto } from './dto/create-inscricoe.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { StatusInscricao } from '@prisma/client';

@ApiTags('Inscrições do Site')
@Controller('inscricoes')
export class InscricoesController {
  constructor(private readonly inscricoesService: InscricoesService) {}

  @Post() // 🌐 ROTA PÚBLICA (Qualquer um no site pode enviar)
  create(@Body() createInscricaoDto: CreateInscricaoDto) {
    return this.inscricoesService.create(createInscricaoDto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard) // 🔒 ROTA PRIVADA (Só a secretaria vê)
  @Get()
  findAll() {
    return this.inscricoesService.findAll();
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.inscricoesService.findOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: StatusInscricao, @Body('observacoesAdmin') observacoes?: string) {
    return this.inscricoesService.updateStatus(id, status, observacoes);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.inscricoesService.remove(id);
  }
}