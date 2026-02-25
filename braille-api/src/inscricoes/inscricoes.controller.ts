import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { InscricoesService } from './inscricoes.service';
import { CreateInscricaoDto } from './dto/create-inscricoe.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { StatusInscricao } from '@prisma/client';
import { QueryInscricaoDto } from './dto/query-inscricao.dto';

@ApiTags('Inscrições do Site')
@Controller('inscricoes')
export class InscricoesController {
  constructor(private readonly inscricoesService: InscricoesService) { }

  @Post()
  @ApiOperation({ summary: 'Enviar inscrição pelo site (rota pública)' })
  create(@Body() createInscricaoDto: CreateInscricaoDto) {
    return this.inscricoesService.create(createInscricaoDto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get()
  @ApiOperation({ summary: 'Listar inscrições com paginação e filtro por status' })
  findAll(@Query() query: QueryInscricaoDto) {
    return this.inscricoesService.findAll(query);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Ver inscrição específica' })
  findOne(@Param('id') id: string) {
    return this.inscricoesService.findOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Patch(':id/status')
  @ApiOperation({ summary: 'Aprovar ou recusar inscrição' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: StatusInscricao,
    @Body('observacoesAdmin') observacoes?: string,
  ) {
    return this.inscricoesService.updateStatus(id, status, observacoes);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Excluir inscrição' })
  remove(@Param('id') id: string) {
    return this.inscricoesService.remove(id);
  }
}