import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { TurmasService } from './turmas.service';
import { CreateTurmaDto } from './dto/create-turma.dto';
import { UpdateTurmaDto } from './dto/update-turma.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Turmas e Oficinas')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard) // Ativa a verificação de Token e de Perfis
@Controller('turmas')
export class TurmasController {
  constructor(private readonly turmasService: TurmasService) {}

  @Post()
  @Roles('ADMIN', 'SECRETARIA') // 👈 Só a gestão pode criar turmas
  @ApiOperation({ summary: 'Criar uma nova turma' })
  create(@Body() createTurmaDto: CreateTurmaDto) {
    return this.turmasService.create(createTurmaDto);
  }

  @Get()
  // 👈 Sem o @Roles() aqui, qualquer um logado (Admin, Secretaria, Professor) pode ver a lista
  @ApiOperation({ summary: 'Listar todas as turmas ativas' })
  findAll() {
    return this.turmasService.findAll();
  }

  @Patch(':id')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Atualizar dados de uma turma' })
  update(@Param('id') id: string, @Body() updateTurmaDto: UpdateTurmaDto) {
    return this.turmasService.update(id, updateTurmaDto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Inativar uma turma' })
  remove(@Param('id') id: string) {
    return this.turmasService.remove(id);
  }
}