import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role, StatusAcompanhamentoIndividual, TipoRegistroAtendimentoIndividual } from '@prisma/client';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../../upload/upload.service';
import { AtendimentosIndividuaisPolicy } from '../policies/atendimentos-individuais.policy';
import { AtendimentosIndividuaisService } from './atendimentos-individuais.service';
import { RelatorioAtendimentoPdfService } from './relatorio-atendimento-pdf.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import type { AuditUser } from '../../common/interfaces/audit-user.interface';

// ─── Helpers ────────────────────────────────────────────────────────────

function makeUser(role: Role, sub = 'user-1'): AuthenticatedUser {
  return { sub, role, nome: 'Teste' };
}

function makeAudit(sub = 'user-1'): AuditUser {
  return { sub, nome: 'Teste', role: Role.ADMIN };
}

function makeAcompanhamento(overrides: Record<string, unknown> = {}) {
  return {
    id: 'acomp-1',
    alunoId: 'aluno-1',
    professorId: 'prof-1',
    assuntoAtual: 'Braille basico',
    descricao: null,
    status: StatusAcompanhamentoIndividual.EM_ANDAMENTO,
    statusAntesArquivamento: null,
    dataInicio: new Date(),
    dataFinalizacao: null,
    resultadoFinal: null,
    resumoFinal: null,
    excluidoEm: null,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    aluno: { id: 'aluno-1', nomeCompleto: 'Aluno Teste', matricula: '202600001', statusAtivo: true },
    professor: { id: 'prof-1', nome: 'Professor Teste', matricula: 'P001', role: Role.PROFESSOR },
    atendimentos: [],
    historicoAssuntos: [],
    _count: { atendimentos: 0 },
    ...overrides,
  };
}

// ─── Suite ──────────────────────────────────────────────────────────────

describe('AtendimentosIndividuaisService', () => {
  let service: AtendimentosIndividuaisService;

  const prisma = {
    acompanhamentoIndividual: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    atendimentoIndividual: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    arquivoAtendimentoIndividual: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    aluno: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };

  const auditService = {
    registrar: jest.fn().mockResolvedValue(undefined),
  };

  const uploadService = {
    uploadArquivoAtendimento: jest.fn(),
  };

  const relatorioPdfService = {
    gerar: jest.fn(),
  };

  const policy = new AtendimentosIndividuaisPolicy();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AtendimentosIndividuaisService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditLogService,
      uploadService as unknown as UploadService,
      policy,
      relatorioPdfService as unknown as RelatorioAtendimentoPdfService,
    );
  });

  // ─── 1. ADMIN arquiva EM_ANDAMENTO ─────────────────────────────────

  it('deve permitir ADMIN arquivar acompanhamento EM_ANDAMENTO salvando statusAntesArquivamento', async () => {
    const original = makeAcompanhamento({ status: StatusAcompanhamentoIndividual.EM_ANDAMENTO });
    prisma.acompanhamentoIndividual.findFirst.mockResolvedValue(original);
    prisma.acompanhamentoIndividual.update.mockResolvedValue({
      ...original,
      status: StatusAcompanhamentoIndividual.ARQUIVADO,
      statusAntesArquivamento: StatusAcompanhamentoIndividual.EM_ANDAMENTO,
    });

    const result = await service.arquivarAcompanhamento('acomp-1', makeUser(Role.ADMIN), makeAudit());

    expect(prisma.acompanhamentoIndividual.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: StatusAcompanhamentoIndividual.ARQUIVADO,
          statusAntesArquivamento: StatusAcompanhamentoIndividual.EM_ANDAMENTO,
        }),
      }),
    );
    expect(result.status).toBe(StatusAcompanhamentoIndividual.ARQUIVADO);
  });

  // ─── 2. ADMIN arquiva FINALIZADO ───────────────────────────────────

  it('deve permitir ADMIN arquivar acompanhamento FINALIZADO salvando statusAntesArquivamento', async () => {
    const original = makeAcompanhamento({ status: StatusAcompanhamentoIndividual.FINALIZADO });
    prisma.acompanhamentoIndividual.findFirst.mockResolvedValue(original);
    prisma.acompanhamentoIndividual.update.mockResolvedValue({
      ...original,
      status: StatusAcompanhamentoIndividual.ARQUIVADO,
      statusAntesArquivamento: StatusAcompanhamentoIndividual.FINALIZADO,
    });

    const result = await service.arquivarAcompanhamento('acomp-1', makeUser(Role.ADMIN), makeAudit());

    expect(prisma.acompanhamentoIndividual.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          statusAntesArquivamento: StatusAcompanhamentoIndividual.FINALIZADO,
        }),
      }),
    );
    expect(result.status).toBe(StatusAcompanhamentoIndividual.ARQUIVADO);
  });

  // ─── 3. Desarquivar FINALIZADO → volta FINALIZADO ─────────────────

  it('deve restaurar status FINALIZADO ao desarquivar acompanhamento que era FINALIZADO', async () => {
    const original = makeAcompanhamento({
      status: StatusAcompanhamentoIndividual.ARQUIVADO,
      statusAntesArquivamento: StatusAcompanhamentoIndividual.FINALIZADO,
    });
    prisma.acompanhamentoIndividual.findFirst.mockResolvedValue(original);
    prisma.acompanhamentoIndividual.update.mockResolvedValue({
      ...original,
      status: StatusAcompanhamentoIndividual.FINALIZADO,
      statusAntesArquivamento: null,
    });

    const result = await service.desarquivarAcompanhamento('acomp-1', makeUser(Role.ADMIN), makeAudit());

    expect(prisma.acompanhamentoIndividual.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: StatusAcompanhamentoIndividual.FINALIZADO,
          statusAntesArquivamento: null,
        }),
      }),
    );
    expect(result.status).toBe(StatusAcompanhamentoIndividual.FINALIZADO);
  });

  // ─── 4. Desarquivar EM_ANDAMENTO → volta EM_ANDAMENTO ─────────────

  it('deve restaurar status EM_ANDAMENTO ao desarquivar acompanhamento que era EM_ANDAMENTO', async () => {
    const original = makeAcompanhamento({
      status: StatusAcompanhamentoIndividual.ARQUIVADO,
      statusAntesArquivamento: StatusAcompanhamentoIndividual.EM_ANDAMENTO,
    });
    prisma.acompanhamentoIndividual.findFirst.mockResolvedValue(original);
    prisma.acompanhamentoIndividual.update.mockResolvedValue({
      ...original,
      status: StatusAcompanhamentoIndividual.EM_ANDAMENTO,
      statusAntesArquivamento: null,
    });

    const result = await service.desarquivarAcompanhamento('acomp-1', makeUser(Role.ADMIN), makeAudit());

    expect(result.status).toBe(StatusAcompanhamentoIndividual.EM_ANDAMENTO);
  });

  // ─── 5. Reabrir ARQUIVADO lança ConflictException ─────────────────

  it('nao deve permitir reabrir acompanhamento ARQUIVADO diretamente', async () => {
    const original = makeAcompanhamento({ status: StatusAcompanhamentoIndividual.ARQUIVADO });
    prisma.acompanhamentoIndividual.findFirst.mockResolvedValue(original);

    await expect(
      service.reabrirAcompanhamento('acomp-1', makeUser(Role.ADMIN), makeAudit()),
    ).rejects.toThrow(ConflictException);
  });

  // ─── 6. SECRETARIA não pode arquivar ──────────────────────────────

  it('deve impedir SECRETARIA de arquivar acompanhamento', async () => {
    const original = makeAcompanhamento();
    prisma.acompanhamentoIndividual.findFirst.mockResolvedValue(original);

    await expect(
      service.arquivarAcompanhamento('acomp-1', makeUser(Role.SECRETARIA), makeAudit()),
    ).rejects.toThrow(ForbiddenException);
  });

  // ─── 7. PROFESSOR não pode arquivar ───────────────────────────────

  it('deve impedir PROFESSOR de arquivar acompanhamento', async () => {
    const original = makeAcompanhamento();
    prisma.acompanhamentoIndividual.findFirst.mockResolvedValue(original);

    await expect(
      service.arquivarAcompanhamento('acomp-1', makeUser(Role.PROFESSOR, 'prof-1'), makeAudit()),
    ).rejects.toThrow(ForbiddenException);
  });

  // ─── 8. SECRETARIA não pode criar atendimento ─────────────────────

  it('deve impedir SECRETARIA de criar atendimento', async () => {
    const original = makeAcompanhamento();
    prisma.acompanhamentoIndividual.findFirst.mockResolvedValue(original);

    await expect(
      service.criarAtendimento('acomp-1', {
        tipoRegistro: TipoRegistroAtendimentoIndividual.FALTA_NAO_JUSTIFICADA,
        dataAtendimento: '2026-05-08',
      } as any, makeUser(Role.SECRETARIA), makeAudit()),
    ).rejects.toThrow(ForbiddenException);
  });

  // ─── 9. PROFESSOR não acessa atendimento de outro professor ───────

  it('deve impedir PROFESSOR de visualizar acompanhamento de outro professor', async () => {
    const original = makeAcompanhamento({ professorId: 'prof-outro' });
    prisma.acompanhamentoIndividual.findFirst.mockResolvedValue(original);

    await expect(
      service.buscarAcompanhamento('acomp-1', makeUser(Role.PROFESSOR, 'prof-1')),
    ).rejects.toThrow(ForbiddenException);
  });

  // ─── 10. horaFim < horaInicio retorna BadRequestException ─────────

  it('deve rejeitar quando horaFim e menor que horaInicio', async () => {
    const original = makeAcompanhamento();
    prisma.acompanhamentoIndividual.findFirst.mockResolvedValue(original);

    await expect(
      service.criarAtendimento('acomp-1', {
        tipoRegistro: TipoRegistroAtendimentoIndividual.FALTA_NAO_JUSTIFICADA,
        dataAtendimento: '2026-05-08',
        horaInicio: '14:00',
        horaFim: '13:00',
      } as any, makeUser(Role.ADMIN), makeAudit()),
    ).rejects.toThrow(BadRequestException);
  });

  // ─── 11. Duração calculada pelo backend ───────────────────────────

  it('deve calcular duracaoMinutos automaticamente quando horaInicio e horaFim existem', async () => {
    const original = makeAcompanhamento();
    prisma.acompanhamentoIndividual.findFirst.mockResolvedValue(original);
    prisma.atendimentoIndividual.create.mockResolvedValue({
      id: 'atend-1',
      acompanhamentoId: 'acomp-1',
      alunoId: 'aluno-1',
      professorId: 'prof-1',
      tipoRegistro: TipoRegistroAtendimentoIndividual.ATENDIMENTO_REALIZADO,
      dataAtendimento: new Date('2026-05-08'),
      horaInicio: '08:00',
      horaFim: '09:30',
      duracaoMinutos: 90,
      arquivos: [],
    });

    await service.criarAtendimento('acomp-1', {
      tipoRegistro: TipoRegistroAtendimentoIndividual.ATENDIMENTO_REALIZADO,
      dataAtendimento: '2026-05-08',
      horaInicio: '08:00',
      horaFim: '09:30',
      assuntoDoDia: 'Leitura em Braille',
      observacao: 'Aula produtiva',
    } as any, makeUser(Role.ADMIN), makeAudit());

    expect(prisma.atendimentoIndividual.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          duracaoMinutos: 90,
        }),
      }),
    );
  });

  // ─── 12. Duração manual quando horaInicio/horaFim ausentes ────────

  it('deve usar duracaoMinutos do DTO quando horaInicio e horaFim nao sao informados', async () => {
    const original = makeAcompanhamento();
    prisma.acompanhamentoIndividual.findFirst.mockResolvedValue(original);
    prisma.atendimentoIndividual.create.mockResolvedValue({
      id: 'atend-1',
      tipoRegistro: TipoRegistroAtendimentoIndividual.FALTA_NAO_JUSTIFICADA,
      dataAtendimento: new Date('2026-05-08'),
      duracaoMinutos: 45,
      arquivos: [],
    });

    await service.criarAtendimento('acomp-1', {
      tipoRegistro: TipoRegistroAtendimentoIndividual.FALTA_NAO_JUSTIFICADA,
      dataAtendimento: '2026-05-08',
      duracaoMinutos: 45,
    } as any, makeUser(Role.ADMIN), makeAudit());

    expect(prisma.atendimentoIndividual.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          duracaoMinutos: 45,
        }),
      }),
    );
  });

  // ─── 13. Upload com assinatura inválida falha ─────────────────────

  it('deve rejeitar upload com assinatura de arquivo invalida', async () => {
    const original = makeAcompanhamento();
    const fakeAtendimento = {
      id: 'atend-1',
      acompanhamento: { id: 'acomp-1', professorId: 'prof-1' },
      arquivos: [],
    };
    prisma.acompanhamentoIndividual.findFirst.mockResolvedValue(original);
    prisma.atendimentoIndividual.findFirst.mockResolvedValue(fakeAtendimento);

    const invalidFile = {
      originalname: 'malware.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('NOT-A-REAL-PDF-FILE'),
      size: 19,
    } as Express.Multer.File;

    await expect(
      service.anexarArquivo('atend-1', invalidFile, 'OUTRO' as any, makeUser(Role.ADMIN), makeAudit()),
    ).rejects.toThrow(BadRequestException);
  });
});
