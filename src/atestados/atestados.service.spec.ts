import { AuditAcao, StatusFrequencia } from '@prisma/client';
import { AtestadosService } from './atestados.service';

describe('AtestadosService', () => {
  const auditUser = {
    sub: 'user-1',
    nome: 'Secretaria',
    role: 'SECRETARIA',
    ip: '127.0.0.1',
    userAgent: 'jest',
  };

  const aluno = { id: 'aluno-1', nomeCompleto: 'Aluno Teste' };
  const atestado = {
    id: 'atest-1',
    alunoId: aluno.id,
    dataInicio: new Date('2026-04-01'),
    dataFim: new Date('2026-04-03'),
    motivo: 'Consulta medica',
    arquivoUrl: 'https://res.cloudinary.com/demo/atest.pdf',
    registradoPorId: auditUser.sub,
  };

  const criarService = () => {
    const tx = {
      atestado: {
        create: jest.fn().mockResolvedValue(atestado),
        delete: jest.fn().mockResolvedValue(atestado),
      },
      frequencia: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };

    const prisma = {
      aluno: {
        findUnique: jest.fn().mockResolvedValue(aluno),
      },
      atestado: {
        findUnique: jest.fn().mockResolvedValue(atestado),
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue({ ...atestado, motivo: 'Retorno medico' }),
      },
      frequencia: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    };

    const uploadService = {
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    const auditService = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    const service = new AtestadosService(prisma as never, uploadService as never, auditService as never);

    return { service, prisma, tx, uploadService, auditService };
  };

  it('registra auditoria ao criar atestado e justificar faltas', async () => {
    const { service, auditService } = criarService();

    await service.criar(
      aluno.id,
      {
        dataInicio: '2026-04-01',
        dataFim: '2026-04-03',
        motivo: 'Consulta medica',
        arquivoUrl: atestado.arquivoUrl,
      },
      auditUser as never,
    );

    expect(auditService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        entidade: 'Atestado',
        registroId: atestado.id,
        acao: AuditAcao.CRIAR,
        autorId: auditUser.sub,
        newValue: expect.objectContaining({ faltasJustificadas: 2 }),
      }),
    );
  });

  it('registra auditoria ao atualizar motivo ou arquivo do atestado', async () => {
    const { service, auditService } = criarService();

    await service.atualizar(atestado.id, { motivo: 'Retorno medico' }, auditUser as never);

    expect(auditService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        entidade: 'Atestado',
        registroId: atestado.id,
        acao: AuditAcao.ATUALIZAR,
        oldValue: atestado,
        newValue: expect.objectContaining({ motivo: 'Retorno medico' }),
      }),
    );
  });

  it('registra auditoria ao remover atestado e reverter frequencias', async () => {
    const { service, tx, auditService } = criarService();

    await service.remover(atestado.id, auditUser as never);

    expect(tx.frequencia.updateMany).toHaveBeenCalledWith({
      where: { justificativaId: atestado.id },
      data: { status: StatusFrequencia.FALTA, justificativaId: null },
    });
    expect(auditService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        entidade: 'Atestado',
        registroId: atestado.id,
        acao: AuditAcao.EXCLUIR,
        oldValue: expect.objectContaining({ faltasRevertidas: 2 }),
        newValue: null,
      }),
    );
  });
});
