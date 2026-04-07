import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { DashboardService } from './dashboard.service';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { EstatisticasResponseDto } from './dto/estatisticas-response.dto';

@ApiTags('Dashboard (Painel Inicial)')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SECRETARIA, Role.COMUNICACAO, Role.PROFESSOR) // Limitando o ACESSO para usuários internos
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('estatisticas')
  @UseInterceptors(CacheInterceptor)
  @CacheKey('estatisticas_home')
  @CacheTTL(300_000) // Formatação limpa para 5 Minutos de TTL
  @ApiOperation({ summary: 'Obter números gerais do sistema para montar os cards da tela inicial' })
  @ApiResponse({ status: 200, description: 'Estatísticas recuperadas com sucesso.', type: EstatisticasResponseDto })
  async getEstatisticas(): Promise<EstatisticasResponseDto> {
    return this.dashboardService.getEstatisticas();
  }
}
