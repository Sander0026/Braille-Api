import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse as SwaggerResponse } from '@nestjs/swagger';
import { AuditLogService } from './audit-log.service';
import { QueryAuditDto } from './dto/query-audit.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ApiResponse } from '../common/dto/api-response.dto';

/**
 * Módulo de auditoria — acesso restrito a ADMIN.
 * Controller magro: apenas roteamento e delegação ao AuditLogService.
 */
@ApiTags('Auditoria (Logs do Sistema)')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('audit-log')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @ApiOperation({ summary: 'Listar logs de auditoria com paginação e filtros (somente ADMIN)' })
  @SwaggerResponse({ status: 200, description: 'Lista de logs retornada com sucesso' })
  findAll(@Query() query: QueryAuditDto): Promise<ApiResponse<unknown>> {
    return this.auditLogService.findAll(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estatísticas rápidas do log (total, hoje em Brasília, top ações)' })
  @SwaggerResponse({ status: 200, description: 'Estatísticas de auditoria' })
  stats(): Promise<ApiResponse<unknown>> {
    return this.auditLogService.stats();
  }

  @Get(':entidade/:registroId')
  @ApiOperation({ summary: 'Ver o histórico de auditoria de um registro específico' })
  @SwaggerResponse({ status: 200, description: 'Histórico localizado' })
  findByRegistro(
    @Param('entidade') entidade: string,
    @Param('registroId') registroId: string,
  ): Promise<ApiResponse<unknown>> {
    return this.auditLogService.findByRegistro(entidade, registroId);
  }
}
