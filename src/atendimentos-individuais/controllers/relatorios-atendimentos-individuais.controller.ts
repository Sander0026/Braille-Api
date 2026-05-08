import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthGuard } from '../../auth/auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { SkipAudit } from '../../common/decorators/skip-audit.decorator';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { AtendimentosIndividuaisService } from '../services/atendimentos-individuais.service';
import { FiltroRelatorioAtendimentoDto } from '../dto/filtro-relatorio-atendimento.dto';

@ApiTags('Atendimentos Individuais - Relatorios')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SECRETARIA, Role.PROFESSOR)
@SkipAudit()
@Controller('atendimentos-individuais/relatorios')
export class RelatoriosAtendimentosIndividuaisController {
  constructor(private readonly service: AtendimentosIndividuaisService) {}

  @Get()
  @ApiOperation({
    summary: 'Gerar relatorio consolidado de atendimentos individuais',
    description:
      'Retorna dados do aluno, professor, acompanhamentos, atendimentos e totais por tipo de registro. Professores veem apenas os proprios registros.',
  })
  @ApiResponse({ status: 200, description: 'Relatorio gerado.' })
  gerar(@Query() query: FiltroRelatorioAtendimentoDto, @Req() req: AuthenticatedRequest) {
    return this.service.gerarRelatorio(query, req.user);
  }
}
