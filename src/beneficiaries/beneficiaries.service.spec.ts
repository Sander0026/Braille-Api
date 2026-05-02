import { BadRequestException } from '@nestjs/common';
import { AuditAcao } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CertificadosService } from '../certificados/certificados.service';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { BeneficiariesService } from './beneficiaries.service';

describe('BeneficiariesService', () => {
  let service: BeneficiariesService;

  const prisma = {
    aluno: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const auditService = {
    registrar: jest.fn().mockResolvedValue(undefined),
  };

  const uploadService = {
    deleteFile: jest.fn(),
  };

  const certificadosService = {
    regenerarCertificadosAluno: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BeneficiariesService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditLogService,
      uploadService as unknown as UploadService,
      certificadosService as unknown as CertificadosService,
    );
  });

  it('deve bloquear planilha maior que o limite antes de carregar workbook', async () => {
    const buffer = Buffer.alloc(5 * 1024 * 1024 + 1);

    await expect(service.importFromSheet(buffer)).rejects.toThrow(BadRequestException);
  });

  it('deve arquivar aluno sem remover fisicamente o registro', async () => {
    prisma.aluno.findUnique.mockResolvedValue({ id: 'aluno-1' });
    prisma.aluno.update.mockResolvedValue({ id: 'aluno-1', excluido: true });

    await service.archivePermanently('aluno-1');

    expect(prisma.aluno.update).toHaveBeenCalledWith({
      where: { id: 'aluno-1' },
      data: { excluido: true },
    });
    expect(auditService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        entidade: 'Aluno',
        registroId: 'aluno-1',
        acao: AuditAcao.ARQUIVAR,
      }),
    );
  });

  it('deve auditar importacao usando o id real do aluno criado', async () => {
    const buffer = await criarPlanilhaValida();

    prisma.aluno.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'aluno-criado-1', matricula: '202600001' }]);
    prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<void>) =>
      callback({
        aluno: {
          count: jest.fn().mockResolvedValue(0),
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      }),
    );

    const result = await service.importFromSheet(buffer);
    await Promise.resolve();
    await Promise.resolve();

    expect(result.importados).toBe(1);
    expect(auditService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        entidade: 'Aluno',
        registroId: 'aluno-criado-1',
        acao: AuditAcao.CRIAR,
      }),
    );
  });
});

async function criarPlanilhaValida(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Alunos');

  sheet.addRow(['Labels']);
  sheet.addRow(['NomeCompleto', 'CPF', 'RG', 'DataNascimento']);
  sheet.addRow(['Aluno Teste', '12345678900', '', '01/01/2000']);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
