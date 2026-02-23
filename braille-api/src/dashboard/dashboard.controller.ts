import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';

@ApiTags('Dashboard (Painel Inicial)')
@ApiBearerAuth()
@UseGuards(AuthGuard) // 👈 Apenas verifica se está logado
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('estatisticas')
  @ApiOperation({ summary: 'Obter números gerais do sistema para montar os cards da tela inicial' })
  getEstatisticas() {
    return this.dashboardService.getEstatisticas();
  }
}