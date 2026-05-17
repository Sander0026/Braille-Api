import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { getAuditUser } from '../common/helpers/audit.helper';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { CreatePdiDto } from './dto/create-pdi.dto';
import { CreatePdiEvolucaoDto } from './dto/create-pdi-evolucao.dto';
import { CreatePdiMetaDto } from './dto/create-pdi-meta.dto';
import { QueryPdiDto } from './dto/query-pdi.dto';
import { UpdatePdiDto } from './dto/update-pdi.dto';
import { UpdatePdiMetaDto } from './dto/update-pdi-meta.dto';
import { PdiService } from './pdi.service';

@ApiTags('PDI')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SECRETARIA, Role.PROFESSOR)
@Controller('pdi')
export class PdiController {
  constructor(private readonly pdiService: PdiService) {}

  @Get()
  @ApiOperation({ summary: 'Listar PDIs com filtros e paginacao' })
  findAll(@Query() query: QueryPdiDto, @Req() req: AuthenticatedRequest) {
    return this.pdiService.findAll(query, req.user);
  }

  @Post()
  @ApiOperation({ summary: 'Criar PDI para aluno' })
  @ApiResponse({ status: 201, description: 'PDI criado.' })
  create(@Body() dto: CreatePdiDto, @Req() req: AuthenticatedRequest) {
    return this.pdiService.create(dto, req.user, getAuditUser(req));
  }

  @Get('aluno/:alunoId')
  @ApiOperation({ summary: 'Listar historico de PDIs de um aluno' })
  findByAluno(@Param('alunoId') alunoId: string, @Req() req: AuthenticatedRequest) {
    return this.pdiService.findByAluno(alunoId, req.user);
  }

  @Get('aluno/:alunoId/ativo')
  @ApiOperation({ summary: 'Buscar PDI ativo de um aluno' })
  findAtivoByAluno(@Param('alunoId') alunoId: string, @Req() req: AuthenticatedRequest) {
    return this.pdiService.findAtivoByAluno(alunoId, req.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhar PDI' })
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.pdiService.findOne(id, req.user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar PDI' })
  update(@Param('id') id: string, @Body() dto: UpdatePdiDto, @Req() req: AuthenticatedRequest) {
    return this.pdiService.update(id, dto, req.user, getAuditUser(req));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Arquivar PDI preservando historico' })
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.pdiService.remove(id, req.user, getAuditUser(req));
  }

  @Post(':id/metas')
  @ApiOperation({ summary: 'Adicionar meta ao PDI' })
  createMeta(@Param('id') id: string, @Body() dto: CreatePdiMetaDto, @Req() req: AuthenticatedRequest) {
    return this.pdiService.createMeta(id, dto, req.user, getAuditUser(req));
  }

  @Patch(':id/metas/:metaId')
  @ApiOperation({ summary: 'Atualizar meta do PDI' })
  updateMeta(
    @Param('id') id: string,
    @Param('metaId') metaId: string,
    @Body() dto: UpdatePdiMetaDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.pdiService.updateMeta(id, metaId, dto, req.user, getAuditUser(req));
  }

  @Delete(':id/metas/:metaId')
  @ApiOperation({ summary: 'Excluir meta do PDI' })
  deleteMeta(@Param('id') id: string, @Param('metaId') metaId: string, @Req() req: AuthenticatedRequest) {
    return this.pdiService.deleteMeta(id, metaId, req.user, getAuditUser(req));
  }

  @Post(':id/evolucoes')
  @ApiOperation({ summary: 'Registrar evolucao do PDI' })
  createEvolucao(@Param('id') id: string, @Body() dto: CreatePdiEvolucaoDto, @Req() req: AuthenticatedRequest) {
    return this.pdiService.createEvolucao(id, dto, req.user, getAuditUser(req));
  }

  @Get(':id/evolucoes')
  @ApiOperation({ summary: 'Listar evolucoes do PDI' })
  listEvolucoes(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.pdiService.listEvolucoes(id, req.user);
  }

  @Delete(':id/evolucoes/:evolucaoId')
  @ApiOperation({ summary: 'Excluir evolucao do PDI' })
  deleteEvolucao(
    @Param('id') id: string,
    @Param('evolucaoId') evolucaoId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.pdiService.deleteEvolucao(id, evolucaoId, req.user, getAuditUser(req));
  }
}
