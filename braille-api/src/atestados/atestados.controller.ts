import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AtestadosService } from './atestados.service';
import { CreateAtestadoDto } from './dto/create-atestado.dto';
import { UpdateAtestadoDto } from './dto/update-atestado.dto';
import { AuthGuard } from '../auth/auth.guard';
import { Role } from '@prisma/client';

// ── Rotas aninhadas: /alunos/:alunoId/atestados ─────────────────────────────
@ApiTags('Atestados (Justificativas de Falta)')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('alunos/:alunoId/atestados')
export class AtestadosController {
  constructor(private readonly atestadosService: AtestadosService) {}

  @Post()
  @ApiOperation({ summary: 'Criar atestado e justificar faltas automaticamente no período' })
  @ApiParam({ name: 'alunoId', description: 'UUID do aluno' })
  criar(@Param('alunoId') alunoId: string, @Body() dto: CreateAtestadoDto) {
    return this.atestadosService.criar(alunoId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os atestados de um aluno' })
  @ApiParam({ name: 'alunoId', description: 'UUID do aluno' })
  listar(@Param('alunoId') alunoId: string) {
    return this.atestadosService.listarPorAluno(alunoId);
  }

  @Get('preview')
  @ApiOperation({ summary: 'Preview: quais faltas serão justificadas (antes de criar o atestado)' })
  @ApiParam({ name: 'alunoId', description: 'UUID do aluno' })
  @ApiQuery({ name: 'dataInicio', example: '2026-03-18' })
  @ApiQuery({ name: 'dataFim', example: '2026-03-20' })
  preview(
    @Param('alunoId') alunoId: string,
    @Query('dataInicio') dataInicio: string,
    @Query('dataFim') dataFim: string,
  ) {
    return this.atestadosService.previewJustificativas(alunoId, dataInicio, dataFim);
  }
}

// ── Rotas por ID: /atestados/:id ─────────────────────────────────────────────
@ApiTags('Atestados (Justificativas de Falta)')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('atestados')
export class AtestadoController {
  constructor(private readonly atestadosService: AtestadosService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Ver detalhe de um atestado' })
  findOne(@Param('id') id: string) {
    return this.atestadosService.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover atestado e reverter faltas justificadas (somente ADMIN)' })
  remover(@Param('id') id: string, @Req() req: any) {
    return this.atestadosService.remover(id, req.user?.role as Role);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar dados básicos de um atestado (Motivo e Arquivo URL)' })
  atualizar(@Param('id') id: string, @Body() updateAtestadoDto: UpdateAtestadoDto) {
    return this.atestadosService.atualizar(id, updateAtestadoDto);
  }
}
