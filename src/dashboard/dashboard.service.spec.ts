import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: PrismaService;

  const mockPrismaService = {
    aluno: { count: jest.fn().mockResolvedValue(10) },
    turma: { count: jest.fn().mockResolvedValue(2) },
    user: { count: jest.fn().mockResolvedValue(5) },
    comunicado: { count: jest.fn().mockResolvedValue(3) },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DashboardService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('deve ser instanciado corretamente', () => {
    expect(service).toBeDefined();
  });

  describe('getEstatisticas()', () => {
    it('deve contar concorrentemente e retornar os 4 resultados empacotados', async () => {
      const result = await service.getEstatisticas();
      expect(prisma.aluno.count).toHaveBeenCalledWith({ where: { statusAtivo: true } });
      expect(prisma.turma.count).toHaveBeenCalledWith({ where: { statusAtivo: true } });
      expect(prisma.user.count).toHaveBeenCalledWith({ where: { statusAtivo: true } });
      expect(prisma.comunicado.count).toHaveBeenCalled();

      expect(result.alunosAtivos).toBe(10);
      expect(result.turmasAtivas).toBe(2);
      expect(result.membrosEquipe).toBe(5);
      expect(result.comunicadosGerais).toBe(3);
    });
  });
});
