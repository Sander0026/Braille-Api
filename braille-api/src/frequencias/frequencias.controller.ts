import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, Req } from '@nestjs/common';
import { FrequenciasService, AuditUserParams } from './frequencias.service';
import { CreateFrequenciaDto } from './dto/create-frequencia.dto';
import { UpdateFrequenciaDto } from './dto/update-frequencia.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { QueryFrequenciaDto } from './dto/query-frequencia.dto';
import { CreateFrequenciaLoteDto } from './dto/create-frequencia-lote.dto';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

function getAuditUser(req: AuthenticatedRequest): AuditUserParams {
  return {
    sub: req.user?.sub ?? '',
    // @ts-ignore
    nome: req.user?.nome || req.user?.email || 'Desconhecido',
    role: req.user?.role ?? 'USER',
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress,
    userAgent: req.headers['user-agent'],
  };
}

@ApiTags('Frequências (Chamadas)')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('frequencias')
export class FrequenciasController {
  constructor(private readonly frequenciasService: FrequenciasService) { }

  @Post()
  @ApiOperation({ summary: 'Registrar chamada de um aluno em uma turma' })
  create(@Body() dto: CreateFrequenciaDto, @Req() req: AuthenticatedRequest) {
    return this.frequenciasService.create(dto, getAuditUser(req));
  }

  @Post('lote')
  @ApiOperation({ summary: 'Registrar ou atualizar chamada em lote (múltiplos alunos da mesma turma e data, via transação isolada)' })
  salvarLote(@Body() dto: CreateFrequenciaLoteDto, @Req() req: AuthenticatedRequest) {
    return this.frequenciasService.salvarLote(dto, getAuditUser(req));
  }

  @Get()
  @ApiOperation({ summary: 'Listar chamadas (com paginação e filtros por turma, aluno e data)' })
  findAll(@Query() query: QueryFrequenciaDto) {
    return this.frequenciasService.findAll(query);
  }

  @Get('resumo')
  @ApiOperation({ summary: 'Listar resumo agrupado de chamadas por aula (inclui status diário fechado)' })
  findResumo(@Query() query: QueryFrequenciaDto) {
    return this.frequenciasService.findResumo(query);
  }

  @Get('relatorio/turma/:turmaId/aluno/:alunoId')
  @ApiOperation({ summary: 'Obter o relatório e cálculo de presenças de um aluno numa turma' })
  getRelatorioAluno(@Param('turmaId') turmaId: string, @Param('alunoId') alunoId: string) {
    return this.frequenciasService.getRelatorioAluno(turmaId, alunoId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver chamada específica' })
  findOne(@Param('id') id: string) {
    return this.frequenciasService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar chamada (professor: só no dia; admin: qualquer data; trava se diário fechado)' })
  update(@Param('id') id: string, @Body() dto: UpdateFrequenciaDto, @Req() req: AuthenticatedRequest) {
    return this.frequenciasService.update(id, dto, getAuditUser(req));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover chamada' })
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.frequenciasService.remove(id, getAuditUser(req));
  }

  // ── Diário ─────────────────────────────────────────────────────────────────

  @Post('diario/fechar/:turmaId/:dataAula')
  @ApiOperation({
    summary: 'Fechar o diário de uma turma numa data — congela a chamada (professor: só hoje; admin: qualquer data)'
  })
  fecharDiario(
    @Param('turmaId') turmaId: string,
    @Param('dataAula') dataAula: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.frequenciasService.fecharDiario(turmaId, dataAula, getAuditUser(req));
  }

  @Post('diario/reabrir/:turmaId/:dataAula')
  @ApiOperation({ summary: 'Reabrir diário fechado para retificação (somente ADMIN)' })
  reabrirDiario(
    @Param('turmaId') turmaId: string,
    @Param('dataAula') dataAula: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.frequenciasService.reabrirDiario(turmaId, dataAula, getAuditUser(req));
  }
}