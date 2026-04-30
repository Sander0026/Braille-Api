import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { FrequenciasService } from './frequencias.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ConfigService } from '@nestjs/config';
import { Role, StatusFrequencia } from '@prisma/client';

const mockPrisma = {
  frequencia: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  turma: { findMany: jest.fn() },
};

const mockAudit = { registrar: jest.fn() };
const mockConfig = { get: jest.fn() };

describe('FrequenciasService', () => {
  let service: FrequenciasService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.frequencia.findFirst.mockResolvedValue(null);
    mockPrisma.frequencia.findMany.mockResolvedValue([]);
    mockPrisma.frequencia.create.mockResolvedValue({ id: '1' });
    mockPrisma.frequencia.count.mockResolvedValue(0);
    mockPrisma.frequencia.groupBy.mockResolvedValue([]);
    mockPrisma.turma.findMany.mockResolvedValue([]);
    mockConfig.get.mockReturnValue('true');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FrequenciasService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLogService, useValue: mockAudit },
        { provide: ConfigService, useValue: mockConfig },
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

  it('deve manter frequencia retroativa permitida por padrao para compatibilidade', async () => {
    await service.create(
      {
        dataAula: '2020-01-01',
        alunoId: '11111111-1111-1111-1111-111111111111',
        turmaId: '22222222-2222-2222-2222-222222222222',
        status: StatusFrequencia.PRESENTE,
      },
      { sub: 'prof-1', nome: 'Professor', role: Role.PROFESSOR },
    );

    expect(mockPrisma.frequencia.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dataAula: new Date('2020-01-01'),
          status: StatusFrequencia.PRESENTE,
          presente: true,
        }),
      }),
    );
  });

  it('deve bloquear frequencia retroativa para professor quando a regra estiver desativada', async () => {
    mockConfig.get.mockReturnValue('false');

    await expect(
      service.create(
        {
          dataAula: '2020-01-01',
          alunoId: '11111111-1111-1111-1111-111111111111',
          turmaId: '22222222-2222-2222-2222-222222222222',
          status: StatusFrequencia.FALTA,
        },
        { sub: 'prof-1', nome: 'Professor', role: Role.PROFESSOR },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockPrisma.frequencia.create).not.toHaveBeenCalled();
  });

  it('deve permitir retificacao retroativa por admin mesmo com regra bloqueada', async () => {
    mockConfig.get.mockReturnValue('false');

    await service.create(
      {
        dataAula: '2020-01-01',
        alunoId: '11111111-1111-1111-1111-111111111111',
        turmaId: '22222222-2222-2222-2222-222222222222',
        status: StatusFrequencia.FALTA,
      },
      { sub: 'admin-1', nome: 'Admin', role: Role.ADMIN },
    );

    expect(mockPrisma.frequencia.create).toHaveBeenCalled();
  });
});
