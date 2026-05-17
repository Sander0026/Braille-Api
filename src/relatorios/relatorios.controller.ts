import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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

  @Get('alunos')
  @ApiOperation({ summary: 'Relatorio de alunos' })
  @ApiResponse({ status: 200, description: 'Relatorio de alunos gerado.' })
  alunos(@Query() query: FiltroRelatorioAlunosDto, @Req() req: AuthenticatedRequest) {
    return this.relatoriosService.alunos(query, req.user);
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
