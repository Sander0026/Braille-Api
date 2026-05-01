import { Test, TestingModule } from '@nestjs/testing';
import { LaudosService } from './laudos.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAcao } from '@prisma/client';

const auditUser = {
  sub: 'user-1',
  nome: 'Secretaria',
  role: 'SECRETARIA',
  ip: '127.0.0.1',
  userAgent: 'jest',
};

const laudo = {
  id: 'laudo1',
  alunoId: 'aluno123',
  dataEmissao: new Date('2026-04-29'),
  medicoResponsavel: 'Dra. Teste',
  descricao: 'Laudo inicial',
  arquivoUrl: 'https://res.cloudinary.com/demo/laudo.pdf',
  registradoPorId: auditUser.sub,
  criadoEm: new Date('2026-04-29'),
  excluidoEm: null,
  excluidoPorId: null,
};

const mockPrisma = {
  laudoMedico: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(laudo),
    create: jest.fn().mockResolvedValue(laudo),
    update: jest.fn().mockResolvedValue({ ...laudo, excluidoEm: new Date('2026-04-29'), excluidoPorId: auditUser.sub }),
  },
  aluno: {
    findUnique: jest.fn().mockResolvedValue({ id: 'aluno123' }),
  },
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
        { provide: AuditLogService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<LaudosService>(LaudosService);
  });

  it('deve encontrar lista de laudos pelo aluno', async () => {
    expect(service).toBeDefined();
    const res = await service.listarPorAluno('aluno123');
    expect(res).toEqual([]);
    expect(mockPrisma.laudoMedico.findMany).toHaveBeenCalledWith({
      where: { alunoId: 'aluno123', excluidoEm: null },
      orderBy: { dataEmissao: 'desc' },
    });
  });

  it('deve revogar laudo por soft delete preservando historico', async () => {
    const res = await service.remover('laudo1', auditUser as never);

    expect(mockPrisma.laudoMedico.update).toHaveBeenCalledWith({
      where: { id: 'laudo1' },
      data: {
        excluidoEm: expect.any(Date),
        excluidoPorId: auditUser.sub,
      },
    });
    expect(mockAudit.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        entidade: 'LaudoMedico',
        registroId: 'laudo1',
        acao: AuditAcao.EXCLUIR,
        oldValue: laudo,
        newValue: expect.objectContaining({ excluidoPorId: auditUser.sub }),
      }),
    );
    expect(res).toEqual({ message: 'Laudo removido da listagem e preservado no historico medico.' });
  });
});
