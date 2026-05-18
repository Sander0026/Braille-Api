import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { AlunoLinhaTempoService } from './aluno-linha-tempo.service';
import { CreateEventoLinhaTempoManualDto } from './dto/create-evento-linha-tempo-manual.dto';
import {
  LinhaTempoAlunoItemDto,
  LinhaTempoAlunoResponseDto,
  LinhaTempoAlunoResumoDto,
} from './dto/linha-tempo-aluno-response.dto';
import { QueryLinhaTempoAlunoDto } from './dto/query-linha-tempo-aluno.dto';

@ApiTags('Linha do tempo do aluno')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SECRETARIA, Role.PROFESSOR)
@Controller('beneficiaries')
export class AlunoLinhaTempoController {
  constructor(private readonly linhaTempoService: AlunoLinhaTempoService) {}

  @Get(':id/linha-tempo')
  @ApiOperation({
    summary: 'Listar linha do tempo persistida do aluno',
    description:
      'Consulta EventoLinhaTempoAluno com filtros, paginacao e regras LGPD. Professores so acessam alunos vinculados; eventos sensiveis retornam mascarados.',
  })
  @ApiParam({ name: 'id', description: 'UUID do aluno' })
  @ApiResponse({ status: 200, description: 'Linha do tempo retornada.', type: LinhaTempoAlunoResponseDto })
  @ApiResponse({ status: 403, description: 'Perfil sem permissao ou professor sem vinculo com o aluno.' })
  @ApiResponse({ status: 404, description: 'Aluno nao encontrado.' })
  findByAluno(
    @Param('id') id: string,
    @Query() query: QueryLinhaTempoAlunoDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.linhaTempoService.findByAluno(id, query, req.user);
  }

  @Get(':id/linha-tempo/resumo')
  @ApiOperation({
    summary: 'Resumo da linha do tempo do aluno',
    description: 'Retorna total de eventos e datas dos ultimos marcos por grupo para cards de resumo.',
  })
  @ApiParam({ name: 'id', description: 'UUID do aluno' })
  @ApiResponse({ status: 200, description: 'Resumo retornado.', type: LinhaTempoAlunoResumoDto })
  @ApiResponse({ status: 403, description: 'Perfil sem permissao ou professor sem vinculo com o aluno.' })
  @ApiResponse({ status: 404, description: 'Aluno nao encontrado.' })
  resumo(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.linhaTempoService.resumo(id, req.user);
  }

  @Post(':id/linha-tempo/manual')
  @Roles(Role.ADMIN, Role.SECRETARIA)
  @ApiOperation({
    summary: 'Registrar observacao manual na linha do tempo do aluno',
    description:
      'Cria evento OBSERVACAO_MANUAL para fatos institucionais relevantes, como reuniao com familia, entrega de material, orientacao avulsa, contato com responsavel ou encaminhamento externo.',
  })
  @ApiParam({ name: 'id', description: 'UUID do aluno' })
  @ApiBody({ type: CreateEventoLinhaTempoManualDto })
  @ApiResponse({ status: 201, description: 'Evento manual registrado.', type: LinhaTempoAlunoItemDto })
  @ApiResponse({ status: 400, description: 'Payload invalido.' })
  @ApiResponse({ status: 404, description: 'Aluno ou turma nao encontrado.' })
  createManual(
    @Param('id') id: string,
    @Body() dto: CreateEventoLinhaTempoManualDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.linhaTempoService.createManual(id, dto, req.user);
  }

  @Delete(':id/linha-tempo/:eventoId')
  @Roles(Role.ADMIN, Role.SECRETARIA)
  @ApiOperation({
    summary: 'Excluir evento manual da linha do tempo do aluno',
    description: 'Remove apenas eventos manuais. Eventos automaticos permanecem auditaveis e devem ser corrigidos na origem.',
  })
  @ApiParam({ name: 'id', description: 'UUID do aluno' })
  @ApiParam({ name: 'eventoId', description: 'UUID do evento' })
  @ApiResponse({ status: 200, description: 'Evento removido.', type: LinhaTempoAlunoItemDto })
  @ApiResponse({ status: 400, description: 'Evento nao pode ser removido por este endpoint.' })
  @ApiResponse({ status: 404, description: 'Aluno ou evento nao encontrado.' })
  removeEvento(@Param('id') id: string, @Param('eventoId') eventoId: string, @Req() req: AuthenticatedRequest) {
    return this.linhaTempoService.removeEventoManual(id, eventoId, req.user);
  }
}
