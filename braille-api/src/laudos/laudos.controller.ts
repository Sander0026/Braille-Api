import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Patch,
  Req,
} from '@nestjs/common';
import { LaudosService, AuditUserParams } from './laudos.service';
import { CreateLaudoDto } from './dto/create-laudo.dto';
import { UpdateLaudoDto } from './dto/update-laudo.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

function getAuditUser(req: AuthenticatedRequest): AuditUserParams {
  return {
    sub: req.user?.sub ?? '',
    // @ts-ignore
    nome: req.user?.nome || req.user?.email || 'Desconhecido',
    role: req.user?.role ?? 'USER',
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress,
    userAgent: req.headers['user-agent'],
  };
}

@UseGuards(AuthGuard, RolesGuard)
@Controller()
export class LaudosController {
  constructor(private readonly laudosService: LaudosService) {}

  @Roles('ADMIN', 'SECRETARIA')
  @Post('alunos/:alunoId/laudos')
  create(
    @Param('alunoId') alunoId: string,
    @Body() createLaudoDto: CreateLaudoDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.laudosService.criar(alunoId, createLaudoDto, getAuditUser(req));
  }

  @Roles('ADMIN', 'SECRETARIA', 'PROFESSOR')
  @Get('alunos/:alunoId/laudos')
  findAll(@Param('alunoId') alunoId: string) {
    return this.laudosService.listarPorAluno(alunoId);
  }

  @Roles('ADMIN', 'SECRETARIA')
  @Patch('laudos/:id')
  update(
    @Param('id') id: string, 
    @Body() updateLaudoDto: UpdateLaudoDto,
    @Req() req: AuthenticatedRequest
  ) {
    return this.laudosService.atualizar(id, updateLaudoDto, getAuditUser(req));
  }

  @Roles('ADMIN', 'SECRETARIA')
  @Delete('laudos/:id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.laudosService.remover(id, getAuditUser(req));
  }
}

