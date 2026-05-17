import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { AlunoLinhaTempoService } from './aluno-linha-tempo.service';
import { QueryLinhaTempoAlunoDto } from './dto/query-linha-tempo-aluno.dto';

@ApiTags('Linha do tempo do aluno')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SECRETARIA, Role.PROFESSOR)
@Controller('beneficiaries')
export class AlunoLinhaTempoController {
  constructor(private readonly linhaTempoService: AlunoLinhaTempoService) {}

  @Get(':id/linha-tempo')
  @ApiOperation({ summary: 'Montar linha do tempo completa do aluno' })
  @ApiParam({ name: 'id', description: 'UUID do aluno' })
  @ApiResponse({ status: 200, description: 'Linha do tempo retornada.' })
  @ApiResponse({ status: 403, description: 'Perfil sem permissao ou professor sem vinculo com o aluno.' })
  @ApiResponse({ status: 404, description: 'Aluno nao encontrado.' })
  findByAluno(
    @Param('id') id: string,
    @Query() query: QueryLinhaTempoAlunoDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.linhaTempoService.findByAluno(id, query, req.user);
  }
}
