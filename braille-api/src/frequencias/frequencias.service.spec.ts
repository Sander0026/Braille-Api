import { Test, TestingModule } from '@nestjs/testing';
import { FrequenciasService } from './frequencias.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

const mockPrisma = {
  frequencia: {
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: '1' }),
    count: jest.fn().mockResolvedValue(0),
    groupBy: jest.fn().mockResolvedValue([]),
  },
  turma: { findMany: jest.fn().mockResolvedValue([]) }
};

const mockAudit = { registrar: jest.fn() };

describe('FrequenciasService', () => {
  let service: FrequenciasService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FrequenciasService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLogService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<FrequenciasService>(FrequenciasService);
  });

  it('deve formatar paginação zero em turmas sem frequencias', async () => {
    const res = await service.findAll({});
    expect(res.data).toEqual([]);
    expect(res.meta.total).toBe(0);
    expect(mockPrisma.frequencia.findMany).toHaveBeenCalled();
  });
});
