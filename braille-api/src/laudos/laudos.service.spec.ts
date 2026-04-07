import { Test, TestingModule } from '@nestjs/testing';
import { LaudosService } from './laudos.service';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { AuditLogService } from '../audit-log/audit-log.service';

const mockPrisma = {
  laudoMedico: {
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'laudo1' }),
  },
  aluno: {
    findUnique: jest.fn().mockResolvedValue({ id: 'aluno123' }),
  },
};

const mockUpload = {
  deleteFile: jest.fn().mockResolvedValue(true),
};

const mockAudit = {
  registrar: jest.fn().mockResolvedValue(true),
};

describe('LaudosService', () => {
  let service: LaudosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LaudosService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: UploadService, useValue: mockUpload },
        { provide: AuditLogService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<LaudosService>(LaudosService);
  });

  it('deve encontrar lista de laudos pelo aluno', async () => {
    expect(service).toBeDefined();
    const res = await service.listarPorAluno('aluno123');
    expect(res).toEqual([]);
    expect(mockPrisma.laudoMedico.findMany).toHaveBeenCalled();
  });
});
