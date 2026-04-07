import { Test, TestingModule } from '@nestjs/testing';
import { TurmasService } from './turmas.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

describe('TurmasService', () => {
  let service: TurmasService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TurmasService,
        { provide: PrismaService, useValue: {} },
        { provide: AuditLogService, useValue: { registrar: jest.fn().mockResolvedValue(true) } },
      ],
    }).compile();

    service = module.get<TurmasService>(TurmasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
