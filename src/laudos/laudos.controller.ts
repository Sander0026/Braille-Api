import { Controller, Get, Post, Body, Param, Delete, UseGuards, Patch, Req } from '@nestjs/common';
import { LaudosService } from './laudos.service';
import { CreateLaudoDto } from './dto/create-laudo.dto';
import { UpdateLaudoDto } from './dto/update-laudo.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { getAuditUser } from '../common/helpers/audit.helper';
import { SkipAudit } from '../common/decorators/skip-audit.decorator';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@ApiTags('Laudos Médicos (Beneficiários)')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@SkipAudit()
@Controller()
export class LaudosController {
  constructor(private readonly laudosService: LaudosService) {}

  @Roles(Role.ADMIN, Role.SECRETARIA)
  @Post('alunos/:alunoId/laudos')
  @ApiOperation({ summary: 'Anexar novo Laudo Médico Digitalizado à pasta do Beneficiário' })
  @ApiParam({ name: 'alunoId', description: 'UUID do aluno' })
  @ApiResponse({ status: 201, description: 'Laudo anexado com sucesso.' })
  @ApiResponse({ status: 400, description: 'Payload inválido.' })
  @ApiResponse({ status: 401, description: 'Token ausente ou expirado.' })
  @ApiResponse({ status: 403, description: 'Role sem permissão (requer ADMIN ou SECRETARIA).' })
  @ApiResponse({ status: 404, description: 'Aluno não encontrado.' })
  create(@Param('alunoId') alunoId: string, @Body() createLaudoDto: CreateLaudoDto, @Req() req: AuthenticatedRequest) {
    return this.laudosService.criar(alunoId, createLaudoDto, getAuditUser(req));
  }

  @Roles(Role.ADMIN, Role.SECRETARIA, Role.PROFESSOR)
  @Get('alunos/:alunoId/laudos')
  @ApiOperation({ summary: 'Listar Laudos Médicos históricos de um aluno específico' })
  @ApiParam({ name: 'alunoId', description: 'UUID do aluno' })
  @ApiResponse({ status: 200, description: 'Lista de laudos retornada.' })
  @ApiResponse({ status: 404, description: 'Aluno não encontrado.' })
  findAll(@Param('alunoId') alunoId: string) {
    return this.laudosService.listarPorAluno(alunoId);
  }

  @Roles(Role.ADMIN, Role.SECRETARIA)
  @Patch('laudos/:id')
  @ApiOperation({ summary: 'Retificar Metadados de um Laudo Médico' })
  @ApiParam({ name: 'id', description: 'UUID do laudo' })
  @ApiResponse({ status: 200, description: 'Laudo atualizado.' })
  @ApiResponse({ status: 400, description: 'Payload inválido.' })
  @ApiResponse({ status: 404, description: 'Laudo não encontrado.' })
  update(@Param('id') id: string, @Body() updateLaudoDto: UpdateLaudoDto, @Req() req: AuthenticatedRequest) {
    return this.laudosService.atualizar(id, updateLaudoDto, getAuditUser(req));
  }

  @Roles(Role.ADMIN, Role.SECRETARIA)
  @Delete('laudos/:id')
  @ApiOperation({ summary: 'Revogar validade e destruir Laudo Médico do sistema' })
  @ApiParam({ name: 'id', description: 'UUID do laudo' })
  @ApiResponse({ status: 200, description: 'Laudo removido.' })
  @ApiResponse({ status: 403, description: 'Role sem permissão.' })
  @ApiResponse({ status: 404, description: 'Laudo não encontrado.' })
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.laudosService.remover(id, getAuditUser(req));
  }
}
