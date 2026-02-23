import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { FrequenciasService } from './frequencias.service';
import { CreateFrequenciaDto } from './dto/create-frequencia.dto';
import { UpdateFrequenciaDto } from './dto/update-frequencia.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';

@ApiTags('Frequências (Chamadas)') // 👈 Nome bonitinho no Swagger
@ApiBearerAuth()                   // 👈 Pede o cadeado no Swagger
@UseGuards(AuthGuard)              // 👈 Ninguém acessa sem estar logado
@Controller('frequencias')
export class FrequenciasController {
  constructor(private readonly frequenciasService: FrequenciasService) {}

  @Post()
  create(@Body() createFrequenciaDto: CreateFrequenciaDto) {
    return this.frequenciasService.create(createFrequenciaDto);
  }

  @Get()
  findAll() {
    return this.frequenciasService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.frequenciasService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateFrequenciaDto: UpdateFrequenciaDto) {
    return this.frequenciasService.update(id, updateFrequenciaDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.frequenciasService.remove(id);
  }
}