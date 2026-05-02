import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { TurmasService } from './turmas.service';
import { CreateTurmaDto } from './dto/create-turma.dto';
import { UpdateTurmaDto } from './dto/update-turma.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { QueryTurmaDto } from './dto/query-turma.dto';
import { IsEnum } from 'class-validator';
import { TurmaStatus, Role } from '@prisma/client';
import { getAuditUser } from '../common/helpers/audit.helper';
import { SkipAudit } from '../common/decorators/skip-audit.decorator';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

class MudarStatusDto {
  @IsEnum(TurmaStatus)
  status: TurmaStatus;
}

@ApiTags('Turmas e Oficinas')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@SkipAudit()
@Controller('turmas')
export class TurmasController {
  constructor(private readonly turmasService: TurmasService) {}

  @Post()
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Criar uma nova turma' })
  create(@Body() createTurmaDto: CreateTurmaDto, @Req() req: AuthenticatedRequest) {
    return this.turmasService.create(createTurmaDto, getAuditUser(req));
  }

  @Get()
  @Roles(Role.ADMIN, Role.SECRETARIA, Role.PROFESSOR)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @ApiOperation({ summary: 'Listar turmas. Use statusAtivo=false para arquivadas.' })
  findAll(@Query() query: QueryTurmaDto) {
    return this.turmasService.findAll(query);
  }

  @Get('professores-ativos')
  @Roles(Role.ADMIN, Role.SECRETARIA, Role.PROFESSOR)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @ApiOperation({ summary: 'Listar apenas professores vinculados a pelo menos uma turma ativa.' })
  findProfessoresAtivos() {
    return this.turmasService.findProfessoresAtivos();
  }

  @Get(':id/alunos-disponiveis')
  @Roles(Role.ADMIN, Role.SECRETARIA)
  @ApiOperation({ summary: 'Lista alunos sem conflito de horário para esta turma' })
  findAlunosDisponiveis(@Param('id') id: string, @Query('nome') nome?: string) {
    return this.turmasService.findAlunosDisponiveis(id, nome);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SECRETARIA, Role.PROFESSOR)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @ApiOperation({ summary: 'Buscar uma turma específica e ver seus alunos' })
  findOne(@Param('id') id: string) {
    return this.turmasService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Atualizar dados de uma turma' })
  update(@Param('id') id: string, @Body() updateTurmaDto: UpdateTurmaDto, @Req() req: AuthenticatedRequest) {
    return this.turmasService.update(id, updateTurmaDto, getAuditUser(req));
  }

  /** Muda o status acadêmico: PREVISTA → ANDAMENTO, ANDAMENTO → CONCLUIDA/CANCELADA, etc. */
  @Patch(':id/status')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Mudar o status acadêmico da turma (PREVISTA/ANDAMENTO/CONCLUIDA/CANCELADA)' })
  @ApiBody({ type: MudarStatusDto })
  mudarStatus(@Param('id') id: string, @Body() body: MudarStatusDto, @Req() req: AuthenticatedRequest) {
    return this.turmasService.mudarStatus(id, body.status, getAuditUser(req));
  }

  @Delete(':id')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Arquivar uma turma (statusAtivo=false). Dados preservados.' })
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.turmasService.arquivar(id, getAuditUser(req));
  }

  @Patch(':id/restaurar')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Restaurar uma turma arquivada para ativa' })
  restaurar(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.turmasService.restaurar(id, getAuditUser(req));
  }

  @Patch(':id/ocultar')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Ocultar uma turma arquivada (some da aba, dados preservados)' })
  ocultar(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.turmasService.ocultar(id, getAuditUser(req));
  }

  // ROTAS DE MATRÍCULA

  @Post(':id/alunos/:alunoId')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Matricular um aluno existente em uma turma' })
  addAluno(@Param('id') id: string, @Param('alunoId') alunoId: string, @Req() req: AuthenticatedRequest) {
    return this.turmasService.addAluno(id, alunoId, getAuditUser(req));
  }

  @Delete(':id/alunos/:alunoId')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Remover (desmatricular) um aluno de uma turma' })
  removeAluno(@Param('id') id: string, @Param('alunoId') alunoId: string, @Req() req: AuthenticatedRequest) {
    return this.turmasService.removeAluno(id, alunoId, getAuditUser(req));
  }

  @Patch(':id/cancelar')
  @Roles(Role.ADMIN, Role.SECRETARIA)
  @ApiOperation({ summary: 'Mudar status da turma inteiro para Cancelada de forma atalho' })
  cancelar(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.turmasService.cancelar(id, getAuditUser(req));
  }

  @Patch(':id/concluir')
  @Roles(Role.ADMIN, Role.SECRETARIA)
  @ApiOperation({ summary: 'Mudar status da turma inteiro para Concluida de forma atalho' })
  concluir(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.turmasService.concluir(id, getAuditUser(req));
  }
}
