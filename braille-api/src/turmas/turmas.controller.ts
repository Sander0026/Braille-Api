import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { TurmasService } from './turmas.service';
import { CreateTurmaDto } from './dto/create-turma.dto';
import { UpdateTurmaDto } from './dto/update-turma.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { QueryTurmaDto } from './dto/query-turma.dto';
import { IsEnum } from 'class-validator';
import { TurmaStatus } from '@prisma/client';

class MudarStatusDto {
  @IsEnum(TurmaStatus)
  status: TurmaStatus;
}

@ApiTags('Turmas e Oficinas')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('turmas')
export class TurmasController {
  constructor(private readonly turmasService: TurmasService) { }

  @Post()
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Criar uma nova turma' })
  create(@Body() createTurmaDto: CreateTurmaDto) {
    return this.turmasService.create(createTurmaDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar turmas. Use statusAtivo=false para arquivadas.' })
  findAll(@Query() query: QueryTurmaDto) {
    return this.turmasService.findAll(query);
  }

  @Get('professores-ativos')
  @ApiOperation({ summary: 'Listar apenas professores vinculados a pelo menos uma turma ativa.' })
  findProfessoresAtivos() {
    return this.turmasService.findProfessoresAtivos();
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

  /** Muda o status acadêmico: PREVISTA → ANDAMENTO, ANDAMENTO → CONCLUIDA/CANCELADA, etc. */
  @Patch(':id/status')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Mudar o status acadêmico da turma (PREVISTA/ANDAMENTO/CONCLUIDA/CANCELADA)' })
  @ApiBody({ type: MudarStatusDto })
  mudarStatus(@Param('id') id: string, @Body() body: MudarStatusDto) {
    return this.turmasService.mudarStatus(id, body.status);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Arquivar uma turma (statusAtivo=false). Dados preservados.' })
  remove(@Param('id') id: string) {
    return this.turmasService.arquivar(id);
  }

  @Patch(':id/restaurar')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Restaurar uma turma arquivada para ativa' })
  restaurar(@Param('id') id: string) {
    return this.turmasService.restaurar(id);
  }

  @Patch(':id/ocultar')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Ocultar uma turma arquivada (some da aba, dados preservados)' })
  ocultar(@Param('id') id: string) {
    return this.turmasService.ocultar(id);
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

  @Patch(':id/cancelar')
  cancelar(@Param('id') id: string) {
    return this.turmasService.cancelar(id);
  }

  @Patch(':id/concluir')
  concluir(@Param('id') id: string) {
    return this.turmasService.concluir(id);
  }
}