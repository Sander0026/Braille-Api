import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthGuard } from '../../auth/auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { SkipAudit } from '../../common/decorators/skip-audit.decorator';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { RelatoriosAtendimentosIndividuaisService } from '../services/relatorios-atendimentos-individuais.service';
import { FiltroRelatorioAtendimentoDto } from '../dto/filtro-relatorio-atendimento.dto';

@ApiTags('Atendimentos Individuais - Relatorios')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SECRETARIA, Role.PROFESSOR)
@SkipAudit()
@Controller('atendimentos-individuais/relatorios')
export class RelatoriosAtendimentosIndividuaisController {
  constructor(private readonly service: RelatoriosAtendimentosIndividuaisService) {}

  @Get()
  @ApiOperation({
    summary: 'Gerar relatorio consolidado de atendimentos individuais',
    description:
      'Retorna dados do aluno, professor, acompanhamentos, atendimentos e totais por tipo de registro. Professores veem apenas os proprios registros.',
  })
  @ApiResponse({ status: 200, description: 'Relatorio gerado.' })
  gerar(@Query() query: FiltroRelatorioAtendimentoDto, @Req() req: AuthenticatedRequest) {
    return this.service.gerar(query, req.user);
  }

  @Post('pdf')
  @ApiOperation({
    summary: 'Exportar relatorio de atendimentos individuais em PDF',
    description:
      'Gera um PDF institucional simples a partir dos mesmos filtros do relatorio JSON. Professores veem apenas os proprios registros.',
  })
  @ApiResponse({ status: 200, description: 'PDF gerado.' })
  async gerarPdf(
    @Body() body: FiltroRelatorioAtendimentoDto,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const buffer = await this.service.gerarPdf(body, req.user);
    const date = new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="relatorio-atendimento-individual-${date}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }
}
