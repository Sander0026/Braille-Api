import { Test, TestingModule } from '@nestjs/testing';
import { SiteConfigService } from './site-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

const mockPrisma = {
  siteConfig: {
    findMany: jest.fn().mockResolvedValue([]),
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    createMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  conteudoSecao: {
    findMany: jest.fn().mockResolvedValue([]),
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    createMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  $transaction: jest.fn().mockImplementation(async (cb) => {
    if (typeof cb === 'function') return cb(mockPrisma);
    else if (Array.isArray(cb)) return await Promise.all(cb);
  }),
};

const mockAudit = { registrar: jest.fn().mockResolvedValue(true) };

describe('SiteConfigService', () => {
  let service: SiteConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SiteConfigService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLogService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<SiteConfigService>(SiteConfigService);
  });

  it('deve retornar default configs quando vazio no bd', async () => {
    expect(service).toBeDefined();
    const result = await service.getAll();
    expect(result.nomeInstituto).toBeDefined();
    expect(mockPrisma.siteConfig.findMany).toHaveBeenCalled();
  });
});
