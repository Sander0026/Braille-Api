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
@UseGuards(AuthGuard, RolesGuard)
@Controller('turmas')
export class TurmasController {
  constructor(private readonly turmasService: TurmasService) {}

  @Post()
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Criar uma nova turma' })
  create(@Body() createTurmaDto: CreateTurmaDto) {
    return this.turmasService.create(createTurmaDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas as turmas ativas' })
  findAll() {
    return this.turmasService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar uma turma específica e ver seus alunos' })
  findOne(@Param('id') id: string) {
    return this.turmasService.findOne(id);
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

  // ROTAS DE MATRÍCULA

  @Post(':id/alunos/:alunoId')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Matricular um aluno existente em uma turma' })
  addAluno(@Param('id') id: string, @Param('alunoId') alunoId: string) {
    return this.turmasService.addAluno(id, alunoId);
  }

  @Delete(':id/alunos/:alunoId')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Remover (desmatricular) um aluno de uma turma' })
  removeAluno(@Param('id') id: string, @Param('alunoId') alunoId: string) {
    return this.turmasService.removeAluno(id, alunoId);
  }
}