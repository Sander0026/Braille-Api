import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { DashboardService } from './dashboard.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';

@ApiTags('Dashboard (Painel Inicial)')
@ApiBearerAuth()
@UseGuards(AuthGuard) // 👈 Apenas verifica se está logado
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) { }

  @Get('estatisticas')
  @UseInterceptors(CacheInterceptor)
  @CacheKey('estatisticas_home') // Nome do Bucket na RAM
  @CacheTTL(300000) // Tempo de Vida cravado de 5 Minutos (Se TTL Global não atuar corretamente)
  @ApiOperation({ summary: 'Obter números gerais do sistema para montar os cards da tela inicial' })
  getEstatisticas() {
    return this.dashboardService.getEstatisticas();
  }
}