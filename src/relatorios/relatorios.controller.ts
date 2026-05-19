import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SkipAudit } from '../common/decorators/skip-audit.decorator';
import { getAuditUser } from '../common/helpers/audit.helper';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { FiltroRelatorioAlunosDto } from './dto/filtro-relatorio-alunos.dto';
import { FiltroRelatorioAtendimentosDto } from './dto/filtro-relatorio-atendimentos.dto';
import { FiltroRelatorioEvasoesDto } from './dto/filtro-relatorio-evasoes.dto';
import { FiltroRelatorioGeralDto } from './dto/filtro-relatorio-geral.dto';
import { FiltroRelatorioTurmasDto } from './dto/filtro-relatorio-turmas.dto';
import { RelatoriosService } from './relatorios.service';

type FiltroRelatorioAlunosListaQuery = FiltroRelatorioAlunosDto & {
  page?: string;
  limit?: string;
};

const LIMITE_ENDPOINT_LEGADO_ALUNOS = 500;

@ApiTags('Relatorios')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SECRETARIA)
@SkipAudit()
@Controller('relatorios')
export class RelatoriosController {
  constructor(private readonly relatoriosService: RelatoriosService) {}

  @Get('resumo')
  @ApiOperation({ summary: 'Resumo consolidado para a tela central de relatorios' })
  @ApiResponse({ status: 200, description: 'Resumo consolidado gerado.' })
  resumo(@Query() query: FiltroRelatorioGeralDto, @Req() req: AuthenticatedRequest) {
    return this.relatoriosService.resumo(query, req.user);
  }

  @Get('alunos/resumo')
  @ApiOperation({ summary: 'Resumo leve do relatorio de alunos' })
  @ApiResponse({ status: 200, description: 'Resumo de alunos gerado.' })
  alunosResumo(@Query() query: FiltroRelatorioAlunosDto, @Req() req: AuthenticatedRequest) {
    return this.relatoriosService.alunosResumo(query, req.user);
  }

  @Get('alunos/distribuicoes')
  @ApiOperation({ summary: 'Distribuicoes agregadas do relatorio de alunos' })
  @ApiResponse({ status: 200, description: 'Distribuicoes de alunos geradas.' })
  alunosDistribuicoes(@Query() query: FiltroRelatorioAlunosDto, @Req() req: AuthenticatedRequest) {
    return this.relatoriosService.alunosDistribuicoes(query, req.user);
  }

  @Get('alunos/lista')
  @ApiOperation({ summary: 'Lista paginada do relatorio de alunos' })
  @ApiQuery({ name: 'page', required: false, description: 'Pagina da listagem. Padrao: 1.' })
  @ApiQuery({ name: 'limit', required: false, description: 'Itens por pagina. Padrao: 20. Maximo: 50.' })
  @ApiResponse({ status: 200, description: 'Lista paginada de alunos gerada.' })
  alunosLista(@Query() query: FiltroRelatorioAlunosListaQuery, @Req() req: AuthenticatedRequest) {
    return this.relatoriosService.alunosLista(query, req.user);
  }

  @Get('alunos')
  @ApiOperation({
    summary: 'LEGADO: relatorio detalhado de alunos',
    description:
      'Endpoint mantido apenas por compatibilidade. Para novas telas, use /alunos/resumo, /alunos/distribuicoes e /alunos/lista.',
    deprecated: true,
  })
  @ApiResponse({ status: 200, description: 'Relatorio legado de alunos gerado com limite de seguranca.' })
  alunos(@Query() query: FiltroRelatorioAlunosDto, @Req() req: AuthenticatedRequest) {
    return this.relatoriosService.alunos(query, req.user, {
      limiteDetalhes: LIMITE_ENDPOINT_LEGADO_ALUNOS,
    });
  }

  @Get('turmas')
  @ApiOperation({ summary: 'Relatorio de turmas' })
  @ApiResponse({ status: 200, description: 'Relatorio de turmas gerado.' })
  turmas(@Query() query: FiltroRelatorioTurmasDto, @Req() req: AuthenticatedRequest) {
    return this.relatoriosService.turmas(query, req.user);
  }

  @Get('evasoes')
  @ApiOperation({ summary: 'Relatorio de encerramentos e evasoes de matriculas' })
  @ApiResponse({ status: 200, description: 'Relatorio de encerramentos gerado.' })
  evasoes(@Query() query: FiltroRelatorioEvasoesDto, @Req() req: AuthenticatedRequest) {
    return this.relatoriosService.evasoes(query, req.user);
  }

  @Get('risco-evasao')
  @ApiOperation({ summary: 'Indicadores de alunos com risco de evasao' })
  @ApiResponse({ status: 200, description: 'Relatorio de risco de evasao gerado.' })
  riscoEvasao(@Query() query: FiltroRelatorioGeralDto, @Req() req: AuthenticatedRequest) {
    return this.relatoriosService.riscoEvasao(query, req.user);
  }

  @Get('impacto-social')
  @ApiOperation({ summary: 'Relatorio agregado de impacto social com comparativo de periodo' })
  @ApiResponse({ status: 200, description: 'Relatorio de impacto social gerado.' })
  impactoSocial(@Query() query: FiltroRelatorioGeralDto, @Req() req: AuthenticatedRequest) {
    return this.relatoriosService.impactoSocial(query, req.user);
  }

  @Get('atendimentos')
  @ApiOperation({ summary: 'Relatorio de atendimentos individuais' })
  @ApiResponse({ status: 200, description: 'Relatorio de atendimentos gerado.' })
  atendimentos(@Query() query: FiltroRelatorioAtendimentosDto, @Req() req: AuthenticatedRequest) {
    return this.relatoriosService.atendimentos(query, req.user);
  }

  @Get('frequencias')
  @ApiOperation({ summary: 'Relatorio de frequencias' })
  @ApiResponse({ status: 200, description: 'Relatorio de frequencias gerado.' })
  frequencias(@Query() query: FiltroRelatorioGeralDto, @Req() req: AuthenticatedRequest) {
    return this.relatoriosService.frequencias(query, req.user);
  }

  @Get('opcoes/turmas')
  @ApiOperation({ summary: 'Buscar turmas para filtros especificos de relatorios' })
  @ApiQuery({ name: 'busca', required: false, description: 'Trecho do nome da turma. Minimo: 2 caracteres.' })
  @ApiResponse({ status: 200, description: 'Opcoes de turmas encontradas.' })
  opcoesTurmas(@Query('busca') busca?: string) {
    return this.relatoriosService.opcoesTurmas(busca);
  }

  @Get('opcoes/professores')
  @ApiOperation({ summary: 'Buscar professores para filtros especificos de relatorios' })
  @ApiQuery({ name: 'busca', required: false, description: 'Trecho do nome, matricula ou e-mail. Minimo: 2 caracteres.' })
  @ApiResponse({ status: 200, description: 'Opcoes de professores encontradas.' })
  opcoesProfessores(@Query('busca') busca?: string) {
    return this.relatoriosService.opcoesProfessores(busca);
  }

  @Get('opcoes/alunos')
  @ApiOperation({ summary: 'Buscar alunos para filtros especificos de relatorios' })
  @ApiQuery({ name: 'busca', required: false, description: 'Trecho do nome, matricula ou CPF. Minimo: 2 caracteres.' })
  @ApiResponse({ status: 200, description: 'Opcoes de alunos encontradas.' })
  opcoesAlunos(@Query('busca') busca?: string) {
    return this.relatoriosService.opcoesAlunos(busca);
  }

  @Get('opcoes/cidades')
  @ApiOperation({ summary: 'Buscar cidades cadastradas para filtros de relatorios' })
  @ApiQuery({ name: 'busca', required: false, description: 'Inicio do nome da cidade. Minimo: 2 caracteres.' })
  @ApiResponse({ status: 200, description: 'Opcoes de cidades encontradas.' })
  opcoesCidades(@Query('busca') busca?: string) {
    return this.relatoriosService.opcoesCidades(busca);
  }

  @Get('opcoes/bairros')
  @ApiOperation({ summary: 'Buscar bairros cadastrados para filtros de relatorios' })
  @ApiQuery({ name: 'busca', required: false, description: 'Inicio do nome do bairro. Minimo: 2 caracteres.' })
  @ApiQuery({ name: 'cidade', required: false, description: 'Cidade selecionada para refinar bairros.' })
  @ApiResponse({ status: 200, description: 'Opcoes de bairros encontradas.' })
  opcoesBairros(@Query('busca') busca?: string, @Query('cidade') cidade?: string) {
    return this.relatoriosService.opcoesBairros(busca, cidade);
  }

  @Post('exportar/pdf')
  @Roles(Role.ADMIN, Role.SECRETARIA, Role.COMUNICACAO)
  @ApiOperation({ summary: 'Exportar relatorio institucional em PDF' })
  @ApiResponse({ status: 200, description: 'PDF gerado.' })
  async exportarPdf(@Body() body: FiltroRelatorioGeralDto, @Req() req: AuthenticatedRequest, @Res() res: Response) {
    const buffer = await this.relatoriosService.exportarPdf(body, req.user, getAuditUser(req));
    const date = new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="relatorio-institucional-${date}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @Post('exportar/xlsx')
  @Roles(Role.ADMIN, Role.SECRETARIA)
  @ApiOperation({ summary: 'Exportar relatorio institucional em XLSX' })
  @ApiResponse({ status: 200, description: 'XLSX gerado.' })
  async exportarXlsx(@Body() body: FiltroRelatorioGeralDto, @Req() req: AuthenticatedRequest, @Res() res: Response) {
    const buffer = await this.relatoriosService.exportarXlsx(body, req.user, getAuditUser(req));
    const date = new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="relatorio-institucional-${date}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }
}
