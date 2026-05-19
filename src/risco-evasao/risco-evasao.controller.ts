import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { getAuditUser } from '../common/helpers/audit.helper';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { CreateAcaoRiscoEvasaoDto } from './dto/create-acao-risco-evasao.dto';
import { QueryAcoesRiscoEvasaoDto } from './dto/query-acoes-risco-evasao.dto';
import { UpdateAcaoRiscoEvasaoDto } from './dto/update-acao-risco-evasao.dto';
import { RiscoEvasaoService } from './risco-evasao.service';

@ApiTags('Risco de Evasao')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SECRETARIA, Role.PROFESSOR)
@Controller('risco-evasao/acoes')
export class RiscoEvasaoController {
  constructor(private readonly riscoEvasaoService: RiscoEvasaoService) {}

  @Get()
  @ApiOperation({ summary: 'Listar ações de intervenção de risco de evasão' })
  @ApiResponse({ status: 200, description: 'Ações listadas.' })
  findAll(@Query() query: QueryAcoesRiscoEvasaoDto, @Req() req: AuthenticatedRequest) {
    return this.riscoEvasaoService.findAll(query, req.user);
  }

  @Post()
  @Roles(Role.ADMIN, Role.SECRETARIA)
  @ApiOperation({ summary: 'Criar ação de intervenção para aluno em risco de evasão' })
  @ApiResponse({ status: 201, description: 'Ação criada.' })
  create(@Body() dto: CreateAcaoRiscoEvasaoDto, @Req() req: AuthenticatedRequest) {
    return this.riscoEvasaoService.create(dto, req.user, getAuditUser(req));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhar ação de risco de evasão' })
  @ApiResponse({ status: 200, description: 'Ação encontrada.' })
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.riscoEvasaoService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SECRETARIA)
  @ApiOperation({ summary: 'Atualizar ação de risco de evasão' })
  @ApiResponse({ status: 200, description: 'Ação atualizada.' })
  update(@Param('id') id: string, @Body() dto: UpdateAcaoRiscoEvasaoDto, @Req() req: AuthenticatedRequest) {
    return this.riscoEvasaoService.update(id, dto, getAuditUser(req));
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.SECRETARIA)
  @ApiOperation({ summary: 'Atualizar status de ação de risco de evasão' })
  @ApiResponse({ status: 200, description: 'Status atualizado.' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateAcaoRiscoEvasaoDto, @Req() req: AuthenticatedRequest) {
    return this.riscoEvasaoService.updateStatus(id, dto, getAuditUser(req));
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.SECRETARIA)
  @ApiOperation({ summary: 'Cancelar ação de risco de evasão' })
  @ApiResponse({ status: 200, description: 'Ação cancelada.' })
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.riscoEvasaoService.remove(id, getAuditUser(req));
  }
}
