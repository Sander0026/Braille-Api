import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ComunicadosService } from './comunicados.service';
import { CreateComunicadoDto } from './dto/create-comunicado.dto';
import { UpdateComunicadoDto } from './dto/update-comunicado.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';

@ApiTags('Comunicados (Mural)')
@Controller('comunicados')
export class ComunicadosController {
  constructor(private readonly comunicadosService: ComunicadosService) {}

  // 👇 ROTA PROTEGIDA (Precisa de login)
  @Post()
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Criar um novo comunicado' })
  create(@Body() createComunicadoDto: CreateComunicadoDto) {
    return this.comunicadosService.create(createComunicadoDto);
  }

  // 👇 ROTA PÚBLICA (Qualquer um pode ver)
  @Get()
  @ApiOperation({ summary: 'Listar todos os comunicados (Rota Pública)' })
  findAll() {
    return this.comunicadosService.findAll();
  }

  // 👇 ROTA PROTEGIDA (Precisa de login)
  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Editar um comunicado' })
  update(@Param('id') id: string, @Body() updateComunicadoDto: UpdateComunicadoDto) {
    return this.comunicadosService.update(id, updateComunicadoDto);
  }

  // 👇 ROTA PROTEGIDA (Precisa de login)
  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Excluir um comunicado' })
  remove(@Param('id') id: string) {
    return this.comunicadosService.remove(id);
  }
}