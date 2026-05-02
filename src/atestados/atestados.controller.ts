import { Controller, Post, Get, Delete, Param, Body, Query, Req, UseGuards, Patch } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse as SwaggerResponse,
} from '@nestjs/swagger';
import { AtestadosService } from './atestados.service';
import { CreateAtestadoDto } from './dto/create-atestado.dto';
import { UpdateAtestadoDto } from './dto/update-atestado.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { getAuditUser } from '../common/helpers/audit.helper';
import { SkipAudit } from '../common/decorators/skip-audit.decorator';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { ApiResponse } from '../common/dto/api-response.dto';

/**
 * Controller extremamente magro — apenas roteamento HTTP.
 * Toda a lógica de negócio, validação de datas e atomicidade está no AtestadosService.
 *
 * Autorização do DELETE é feita via @Roles + RolesGuard (camada HTTP correta).
 * O Service não recebe nem valida Role — segue o DIP.
 */
@ApiTags('Atestados (Justificativas de Falta)')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@SkipAudit()
@Controller()
export class AtestadosController {
  constructor(private readonly atestadosService: AtestadosService) {}

  // ── Rotas aninhadas: /alunos/:alunoId/atestados ────────────────────────────

  @Post('alunos/:alunoId/atestados')
  @ApiOperation({ summary: 'Criar atestado e justificar faltas automaticamente no período' })
  @ApiParam({ name: 'alunoId', description: 'UUID do aluno' })
  @SwaggerResponse({ status: 201, description: 'Atestado criado' })
  async criar(
    @Param('alunoId') alunoId: string,
    @Body() dto: CreateAtestadoDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<unknown>> {
    return this.atestadosService.criar(alunoId, dto, getAuditUser(req));
  }

  @Get('alunos/:alunoId/atestados')
  @ApiOperation({ summary: 'Listar todos os atestados de um aluno' })
  @ApiParam({ name: 'alunoId', description: 'UUID do aluno' })
  async listar(@Param('alunoId') alunoId: string): Promise<ApiResponse<unknown>> {
    return this.atestadosService.listarPorAluno(alunoId);
  }

  @Get('alunos/:alunoId/atestados/preview')
  @ApiOperation({ summary: 'Preview: quais faltas serão justificadas (antes de criar o atestado)' })
  @ApiParam({ name: 'alunoId', description: 'UUID do aluno' })
  @ApiQuery({ name: 'dataInicio', example: '2026-03-18' })
  @ApiQuery({ name: 'dataFim', example: '2026-03-20' })
  async preview(
    @Param('alunoId') alunoId: string,
    @Query('dataInicio') dataInicio: string,
    @Query('dataFim') dataFim: string,
  ): Promise<ApiResponse<unknown>> {
    return this.atestadosService.previewJustificativas(alunoId, dataInicio, dataFim);
  }

  // ── Rotas por ID: /atestados/:id ───────────────────────────────────────────

  @Get('atestados/:id')
  @ApiOperation({ summary: 'Ver detalhe de um atestado' })
  async findOne(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    return this.atestadosService.findOne(id);
  }

  @Patch('atestados/:id')
  @ApiOperation({ summary: 'Atualizar dados básicos de um atestado (Motivo e Arquivo URL)' })
  async atualizar(
    @Param('id') id: string,
    @Body() dto: UpdateAtestadoDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<unknown>> {
    return this.atestadosService.atualizar(id, dto, getAuditUser(req));
  }

  /**
   * Remove o atestado e reverte faltas para FALTA.
   * Restrito a ADMIN e SECRETARIA via @Roles + RolesGuard (camada HTTP correta).
   * O Service não recebe Role — lógica de autorização centralizada aqui.
   */
  @Delete('atestados/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Remover atestado e reverter faltas justificadas (somente ADMIN e SECRETARIA)' })
  async remover(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<ApiResponse<unknown>> {
    return this.atestadosService.remover(id, getAuditUser(req));
  }
}
