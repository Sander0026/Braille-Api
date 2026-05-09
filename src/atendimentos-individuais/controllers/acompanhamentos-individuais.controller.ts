import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthGuard } from '../../auth/auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { SkipAudit } from '../../common/decorators/skip-audit.decorator';
import { getAuditUser } from '../../common/helpers/audit.helper';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { AcompanhamentosIndividuaisService } from '../services/acompanhamentos-individuais.service';
import { CriarAcompanhamentoIndividualDto } from '../dto/criar-acompanhamento-individual.dto';
import { FiltroAcompanhamentoIndividualDto } from '../dto/filtro-acompanhamento-individual.dto';
import { AtualizarAssuntoAcompanhamentoDto } from '../dto/atualizar-assunto-acompanhamento.dto';
import { FinalizarAcompanhamentoDto } from '../dto/finalizar-acompanhamento.dto';
import { VerificarDuplicidadeAcompanhamentoDto } from '../dto/verificar-duplicidade-acompanhamento.dto';

@ApiTags('Atendimentos Individuais - Acompanhamentos')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SECRETARIA, Role.PROFESSOR)
@SkipAudit()
@Controller('atendimentos-individuais/acompanhamentos')
export class AcompanhamentosIndividuaisController {
  constructor(private readonly service: AcompanhamentosIndividuaisService) {}

  @Post()
  @ApiOperation({
    summary: 'Criar acompanhamento individual',
    description:
      'Cria um vinculo continuo entre aluno e professor. Professores criam apenas para si; ADMIN/SECRETARIA devem informar professorId.',
  })
  @ApiResponse({ status: 201, description: 'Acompanhamento criado.' })
  @ApiResponse({ status: 400, description: 'Dados invalidos.' })
  @ApiResponse({ status: 403, description: 'Usuario sem permissao.' })
  create(@Body() dto: CriarAcompanhamentoIndividualDto, @Req() req: AuthenticatedRequest) {
    return this.service.criar(dto, req.user, getAuditUser(req));
  }

  @Get()
  @ApiOperation({
    summary: 'Listar acompanhamentos individuais',
    description:
      'ADMIN/SECRETARIA visualizam todos. PROFESSOR visualiza somente os acompanhamentos vinculados a ele.',
  })
  @ApiResponse({ status: 200, description: 'Lista paginada retornada.' })
  findAll(@Query() query: FiltroAcompanhamentoIndividualDto, @Req() req: AuthenticatedRequest) {
    return this.service.listar(query, req.user);
  }

  @Get('duplicidade')
  @ApiOperation({ summary: 'Verificar acompanhamento em andamento semelhante antes de criar novo' })
  @ApiResponse({ status: 200, description: 'Resultado da verificacao de duplicidade.' })
  verificarDuplicidade(@Query() query: VerificarDuplicidadeAcompanhamentoDto, @Req() req: AuthenticatedRequest) {
    return this.service.verificarDuplicidade(query, req.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar acompanhamento individual por ID' })
  @ApiParam({ name: 'id', description: 'UUID do acompanhamento' })
  @ApiResponse({ status: 200, description: 'Acompanhamento encontrado.' })
  @ApiResponse({ status: 404, description: 'Acompanhamento nao encontrado.' })
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.buscar(id, req.user);
  }

  @Patch(':id/assunto')
  @ApiOperation({ summary: 'Atualizar assunto do acompanhamento mantendo historico' })
  @ApiParam({ name: 'id', description: 'UUID do acompanhamento' })
  @ApiResponse({ status: 200, description: 'Assunto atualizado.' })
  @ApiResponse({ status: 409, description: 'Acompanhamento finalizado ou arquivado.' })
  atualizarAssunto(
    @Param('id') id: string,
    @Body() dto: AtualizarAssuntoAcompanhamentoDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.atualizarAssunto(id, dto, req.user, getAuditUser(req));
  }

  @Patch(':id/finalizar')
  @ApiOperation({ summary: 'Finalizar acompanhamento individual' })
  @ApiParam({ name: 'id', description: 'UUID do acompanhamento' })
  @ApiResponse({ status: 200, description: 'Acompanhamento finalizado.' })
  @ApiResponse({ status: 409, description: 'Acompanhamento ja finalizado ou arquivado.' })
  finalizar(@Param('id') id: string, @Body() dto: FinalizarAcompanhamentoDto, @Req() req: AuthenticatedRequest) {
    return this.service.finalizar(id, dto, req.user, getAuditUser(req));
  }

  @Patch(':id/reabrir')
  @ApiOperation({ summary: 'Reabrir acompanhamento individual finalizado ou arquivado' })
  @ApiParam({ name: 'id', description: 'UUID do acompanhamento' })
  @ApiResponse({ status: 200, description: 'Acompanhamento reaberto.' })
  reabrir(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.reabrir(id, req.user, getAuditUser(req));
  }

  @Patch(':id/arquivar')
  @ApiOperation({ summary: 'Arquivar acompanhamento individual para ocultacao administrativa' })
  @ApiParam({ name: 'id', description: 'UUID do acompanhamento' })
  @ApiResponse({ status: 200, description: 'Acompanhamento arquivado.' })
  arquivar(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.arquivar(id, req.user, getAuditUser(req));
  }

  @Patch(':id/desarquivar')
  @ApiOperation({ summary: 'Desarquivar acompanhamento individual' })
  @ApiParam({ name: 'id', description: 'UUID do acompanhamento' })
  @ApiResponse({ status: 200, description: 'Acompanhamento desarquivado.' })
  desarquivar(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.desarquivar(id, req.user, getAuditUser(req));
  }
}
