import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import type { QueryAuditDto } from './audit-log.service';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';

import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Auditoria (Logs do Sistema)')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('audit-log')
export class AuditLogController {
    constructor(private readonly auditLogService: AuditLogService) { }

    @Get()
    @ApiOperation({ summary: 'Listar logs de auditoria com filtros (somente ADMIN)' })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    @ApiQuery({ name: 'entidade', required: false, description: 'Ex: Aluno | User | Turma | Frequencia' })
    @ApiQuery({ name: 'acao', required: false })
    @ApiQuery({ name: 'autorId', required: false })
    @ApiQuery({ name: 'de', required: false, description: 'Data início ISO' })
    @ApiQuery({ name: 'ate', required: false, description: 'Data fim ISO' })
    findAll(@Query() query: QueryAuditDto) {
        return this.auditLogService.findAll(query);
    }

    @Get('stats')
    @ApiOperation({ summary: 'Estatísticas rápidas do log (total, hoje, top ações)' })
    stats() {
        return this.auditLogService.stats();
    }

    @Get(':entidade/:registroId')
    @ApiOperation({ summary: 'Ver todo o histórico de auditoria de um registro específico' })
    findByRegistro(
        @Param('entidade') entidade: string,
        @Param('registroId') registroId: string,
    ) {
        return this.auditLogService.findByRegistro(entidade, registroId);
    }
}
