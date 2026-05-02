import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { EstatisticasResponseDto } from './dto/estatisticas-response.dto';

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: DashboardService;

  const mockDashboardService = {
    getEstatisticas: jest.fn().mockResolvedValue({
      alunosAtivos: 10,
      turmasAtivas: 2,
      membrosEquipe: 5,
      comunicadosGerais: 3,
    } as EstatisticasResponseDto),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: mockDashboardService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideInterceptor(CacheInterceptor)
      .useValue({ intercept: (context: any, next: any) => next.handle() })
      .compile();

    controller = module.get<DashboardController>(DashboardController);
    service = module.get<DashboardService>(DashboardService);
  });

  it('deve ser instanciado corretamente', () => {
    expect(controller).toBeDefined();
  });

  describe('getEstatisticas()', () => {
    it('deve extrair estatisticas do DashboardService', async () => {
      const result = await controller.getEstatisticas();
      expect(service.getEstatisticas).toHaveBeenCalled();
      expect(result).toHaveProperty('alunosAtivos', 10);
    });
  });
});
