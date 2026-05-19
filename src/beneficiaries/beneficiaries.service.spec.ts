import { BadRequestException } from '@nestjs/common';
import { AuditAcao, MatriculaStatus, MotivoEncerramentoMatricula, MotivoInativacaoAluno, Role } from '@prisma/client';
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

  const eventoLinhaTempoService = {
    registrarEvento: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BeneficiariesService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditLogService,
      uploadService as unknown as UploadService,
      certificadosService as unknown as CertificadosService,
      eventoLinhaTempoService as never,
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

  it('deve inativar aluno com motivo e encerrar matriculas ativas na mesma transacao', async () => {
    const tx = {
      aluno: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'aluno-1',
          statusAtivo: true,
          motivoInativacao: null,
          observacaoInativacao: null,
          inativadoEm: null,
          inativadoPorId: null,
        }),
        update: jest.fn().mockResolvedValue({
          id: 'aluno-1',
          statusAtivo: false,
          motivoInativacao: MotivoInativacaoAluno.MUDANCA_DE_CIDADE,
        }),
      },
      matriculaOficina: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'matricula-1',
            turmaId: 'turma-1',
            turma: { nome: 'Braille Nivel 1', professor: { nome: 'Professor' } },
          },
          {
            id: 'matricula-2',
            turmaId: 'turma-2',
            turma: { nome: 'Soroban', professor: null },
          },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    prisma.$transaction.mockImplementationOnce(async (callback: (txArg: typeof tx) => Promise<unknown>) =>
      callback(tx),
    );

    await service.remove(
      'aluno-1',
      {
        motivoInativacao: MotivoInativacaoAluno.MUDANCA_DE_CIDADE,
        observacao: ' Mudou de cidade ',
        encerrarMatriculasAtivas: true,
        statusMatricula: MatriculaStatus.TRANSFERIDA,
      },
      {
        sub: 'user-1',
        nome: 'Secretaria',
        role: Role.SECRETARIA,
      },
    );

    expect(tx.aluno.update).toHaveBeenCalledWith({
      where: { id: 'aluno-1' },
      data: expect.objectContaining({
        statusAtivo: false,
        motivoInativacao: MotivoInativacaoAluno.MUDANCA_DE_CIDADE,
        observacaoInativacao: 'Mudou de cidade',
        inativadoPorId: 'user-1',
      }),
    });
    expect(tx.matriculaOficina.findMany).toHaveBeenCalledWith({
      where: {
        alunoId: 'aluno-1',
        status: MatriculaStatus.ATIVA,
      },
      select: {
        id: true,
        turmaId: true,
        turma: {
          select: {
            nome: true,
            professor: { select: { nome: true } },
          },
        },
      },
      orderBy: { dataEntrada: 'asc' },
    });
    expect(tx.matriculaOficina.updateMany).toHaveBeenCalledWith({
      where: {
        alunoId: 'aluno-1',
        status: MatriculaStatus.ATIVA,
      },
      data: expect.objectContaining({
        status: MatriculaStatus.TRANSFERIDA,
        motivoEncerramento: MotivoEncerramentoMatricula.MUDANCA_DE_CIDADE,
        observacao: 'Mudou de cidade',
        encerradoPorId: 'user-1',
      }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entidade: 'Aluno',
        registroId: 'aluno-1',
        acao: AuditAcao.EXCLUIR,
        autorId: 'user-1',
      }),
    });
    expect(eventoLinhaTempoService.registrarEvento).toHaveBeenCalledWith(
      expect.objectContaining({
        alunoId: 'aluno-1',
        turmaId: 'turma-1',
        tipo: 'ENCERRAMENTO_MATRICULA',
        origem: 'MATRICULA_OFICINA',
        origemId: 'matricula-1',
        chaveEvento: 'MATRICULA_OFICINA:matricula-1:ENCERRAMENTO_MATRICULA',
        turmaNomeSnapshot: 'Braille Nivel 1',
        professorNomeSnapshot: 'Professor',
      }),
    );
    expect(eventoLinhaTempoService.registrarEvento).toHaveBeenCalledWith(
      expect.objectContaining({
        alunoId: 'aluno-1',
        tipo: 'INATIVACAO',
        origem: 'ALUNO',
      }),
    );
  });

  it('deve bloquear inativacao sem encerramento quando houver matriculas ativas', async () => {
    const tx = {
      aluno: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'aluno-1',
          statusAtivo: true,
          motivoInativacao: null,
          observacaoInativacao: null,
          inativadoEm: null,
          inativadoPorId: null,
        }),
        update: jest.fn(),
      },
      matriculaOficina: {
        count: jest.fn().mockResolvedValue(1),
        updateMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementationOnce(async (callback: (txArg: typeof tx) => Promise<unknown>) =>
      callback(tx),
    );

    await expect(
      service.remove('aluno-1', {
        motivoInativacao: MotivoInativacaoAluno.OUTRO,
        encerrarMatriculasAtivas: false,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(tx.aluno.update).not.toHaveBeenCalled();
    expect(tx.matriculaOficina.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
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
