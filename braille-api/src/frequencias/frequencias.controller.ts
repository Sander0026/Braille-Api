import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { FrequenciasService } from './frequencias.service';
import { CreateFrequenciaDto } from './dto/create-frequencia.dto';
import { UpdateFrequenciaDto } from './dto/update-frequencia.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { QueryFrequenciaDto } from './dto/query-frequencia.dto';

@ApiTags('Frequências (Chamadas)')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('frequencias')
export class FrequenciasController {
  constructor(private readonly frequenciasService: FrequenciasService) { }

  @Post()
  @ApiOperation({ summary: 'Registrar chamada de um aluno em uma turma' })
  create(@Body() createFrequenciaDto: CreateFrequenciaDto) {
    return this.frequenciasService.create(createFrequenciaDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar chamadas (com paginação e filtros por turma, aluno e data)' })
  findAll(@Query() query: QueryFrequenciaDto) {
    return this.frequenciasService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver chamada específica' })
  findOne(@Param('id') id: string) {
    return this.frequenciasService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar chamada' })
  update(@Param('id') id: string, @Body() updateFrequenciaDto: UpdateFrequenciaDto) {
    return this.frequenciasService.update(id, updateFrequenciaDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover chamada' })
  remove(@Param('id') id: string) {
    return this.frequenciasService.remove(id);
  }
}