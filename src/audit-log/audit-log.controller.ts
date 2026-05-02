import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiResponse as SwaggerResponse } from '@nestjs/swagger';
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
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('audit-log')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @ApiOperation({ summary: 'Listar logs de auditoria com paginação e filtros (somente ADMIN)' })
  @SwaggerResponse({ status: 200, description: 'Lista de logs retornada com sucesso' })
  @SwaggerResponse({ status: 401, description: 'Token ausente ou expirado.' })
  @SwaggerResponse({ status: 403, description: 'Requer role ADMIN.' })
  findAll(@Query() query: QueryAuditDto): Promise<ApiResponse<unknown>> {
    return this.auditLogService.findAll(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estatísticas rápidas do log (total, hoje em Brasília, top ações)' })
  @SwaggerResponse({ status: 200, description: 'Estatísticas de auditoria' })
  @SwaggerResponse({ status: 401, description: 'Token ausente ou expirado.' })
  @SwaggerResponse({ status: 403, description: 'Requer role ADMIN.' })
  stats(): Promise<ApiResponse<unknown>> {
    return this.auditLogService.stats();
  }

  @Get(':entidade/:registroId')
  @ApiOperation({ summary: 'Ver o histórico de auditoria de um registro específico' })
  @ApiParam({ name: 'entidade', description: 'Nome da entidade (ex: User, Turma, Beneficiary)' })
  @ApiParam({ name: 'registroId', description: 'UUID do registro' })
  @SwaggerResponse({ status: 200, description: 'Histórico localizado' })
  @SwaggerResponse({ status: 401, description: 'Token ausente ou expirado.' })
  @SwaggerResponse({ status: 403, description: 'Requer role ADMIN.' })
  @SwaggerResponse({ status: 404, description: 'Registro não encontrado nos logs.' })
  findByRegistro(
    @Param('entidade') entidade: string,
    @Param('registroId') registroId: string,
  ): Promise<ApiResponse<unknown>> {
    return this.auditLogService.findByRegistro(entidade, registroId);
  }
}
