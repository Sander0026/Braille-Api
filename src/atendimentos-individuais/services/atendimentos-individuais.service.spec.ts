import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditAcao, CategoriaArquivoAtendimentoIndividual, Role, StatusAcompanhamentoIndividual, TipoRegistroAtendimentoIndividual } from '@prisma/client';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../../upload/upload.service';
import { AtendimentosIndividuaisPolicy } from '../policies/atendimentos-individuais.policy';
import { AtendimentosIndividuaisService } from './atendimentos-individuais.service';
import { AtendimentosIndividuaisAuditService } from './atendimentos-individuais-audit.service';
import { AtendimentosIndividuaisSanitizerService } from './atendimentos-individuais-sanitizer.service';
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
      update: jest.fn(),
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
  const sanitizer = new AtendimentosIndividuaisSanitizerService();

  beforeEach(() => {
    jest.clearAllMocks();
    const audit = new AtendimentosIndividuaisAuditService(auditService as unknown as AuditLogService);
    service = new AtendimentosIndividuaisService(
      prisma as unknown as PrismaService,
      uploadService as unknown as UploadService,
      policy,
      relatorioPdfService as unknown as RelatorioAtendimentoPdfService,
      sanitizer,
      audit,
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
          arquivadoPorId: 'user-1',
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
          arquivadoPorId: 'user-1',
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
          desarquivadoPorId: 'user-1',
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

  it('deve impedir SECRETARIA de desarquivar acompanhamento', async () => {
    const original = makeAcompanhamento({ status: StatusAcompanhamentoIndividual.ARQUIVADO });
    prisma.acompanhamentoIndividual.findFirst.mockResolvedValue(original);

    await expect(
      service.desarquivarAcompanhamento('acomp-1', makeUser(Role.SECRETARIA), makeAudit()),
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

  it('deve impedir PROFESSOR de desarquivar acompanhamento', async () => {
    const original = makeAcompanhamento({ status: StatusAcompanhamentoIndividual.ARQUIVADO });
    prisma.acompanhamentoIndividual.findFirst.mockResolvedValue(original);

    await expect(
      service.desarquivarAcompanhamento('acomp-1', makeUser(Role.PROFESSOR, 'prof-1'), makeAudit()),
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
      duracaoMinutos: 999,
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

  it('deve salvar modalidade e localAtendimento ao criar atendimento', async () => {
    const original = makeAcompanhamento();
    prisma.acompanhamentoIndividual.findFirst.mockResolvedValue(original);
    prisma.atendimentoIndividual.create.mockResolvedValue({
      id: 'atend-1',
      tipoRegistro: TipoRegistroAtendimentoIndividual.FALTA_NAO_JUSTIFICADA,
      dataAtendimento: new Date('2026-05-08'),
      modalidade: 'PRESENCIAL',
      localAtendimento: 'Sala 2',
      arquivos: [],
    });

    await service.criarAtendimento('acomp-1', {
      tipoRegistro: TipoRegistroAtendimentoIndividual.FALTA_NAO_JUSTIFICADA,
      dataAtendimento: '2026-05-08',
      modalidade: 'PRESENCIAL',
      localAtendimento: 'Sala 2',
    } as any, makeUser(Role.ADMIN), makeAudit());

    expect(prisma.atendimentoIndividual.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          modalidade: 'PRESENCIAL',
          localAtendimento: 'Sala 2',
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

  it('deve auditar download de arquivo sem registrar a URL real no log', async () => {
    prisma.arquivoAtendimentoIndividual.findUnique.mockResolvedValue({
      id: 'arq-1',
      atendimentoId: 'atend-1',
      nomeOriginal: 'atestado.pdf',
      urlArquivo: 'https://res.cloudinary.com/demo/raw/upload/atestado.pdf',
      tipoArquivo: 'application/pdf',
      tamanho: 2048,
      categoria: CategoriaArquivoAtendimentoIndividual.ATESTADO,
      atendimento: {
        alunoId: 'aluno-1',
        professorId: 'prof-1',
        acompanhamento: {
          id: 'acomp-1',
          alunoId: 'aluno-1',
          professorId: 'prof-1',
        },
      },
    });

    const arquivo = await service.obterArquivoParaDownload('arq-1', makeUser(Role.ADMIN), makeAudit());

    expect(arquivo.url).toContain('cloudinary.com');
    expect(auditService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        entidade: 'ArquivoAtendimentoIndividual',
        registroId: 'arq-1',
        acao: AuditAcao.DOWNLOAD,
        newValue: expect.objectContaining({
          arquivoId: 'arq-1',
          atendimentoId: 'atend-1',
          acompanhamentoId: 'acomp-1',
          alunoId: 'aluno-1',
          professorId: 'prof-1',
          categoria: CategoriaArquivoAtendimentoIndividual.ATESTADO,
          tipoArquivo: 'application/pdf',
          usuarioId: 'user-1',
          baixadoEm: expect.any(String),
        }),
      }),
    );
    expect(auditService.registrar).not.toHaveBeenCalledWith(
      expect.objectContaining({
        newValue: expect.objectContaining({
          urlArquivo: expect.any(String),
        }),
      }),
    );
  });

  it('deve impedir download de arquivo para professor sem permissao', async () => {
    prisma.arquivoAtendimentoIndividual.findUnique.mockResolvedValue({
      id: 'arq-1',
      atendimentoId: 'atend-1',
      nomeOriginal: 'atestado.pdf',
      urlArquivo: 'https://res.cloudinary.com/demo/raw/upload/atestado.pdf',
      tipoArquivo: 'application/pdf',
      tamanho: 2048,
      categoria: CategoriaArquivoAtendimentoIndividual.ATESTADO,
      atendimento: {
        alunoId: 'aluno-1',
        professorId: 'prof-outro',
        acompanhamento: {
          id: 'acomp-1',
          alunoId: 'aluno-1',
          professorId: 'prof-outro',
        },
      },
    });

    await expect(
      service.obterArquivoParaDownload('arq-1', makeUser(Role.PROFESSOR, 'prof-1'), makeAudit()),
    ).rejects.toThrow(ForbiddenException);
    expect(auditService.registrar).not.toHaveBeenCalledWith(expect.objectContaining({ acao: AuditAcao.DOWNLOAD }));
  });

  it('deve sinalizar falta justificada com comprovante quando houver ATESTADO', async () => {
    prisma.atendimentoIndividual.findFirst.mockResolvedValue({
      id: 'atend-1',
      tipoRegistro: TipoRegistroAtendimentoIndividual.FALTA_JUSTIFICADA,
      dataAtendimento: new Date('2026-05-08'),
      arquivos: [
        {
          id: 'arq-1',
          nomeOriginal: 'atestado.pdf',
          urlArquivo: 'https://res.cloudinary.com/demo/raw/upload/atestado.pdf',
          categoria: CategoriaArquivoAtendimentoIndividual.ATESTADO,
        },
      ],
      acompanhamento: {
        id: 'acomp-1',
        professorId: 'prof-1',
      },
    });

    const atendimento = await service.buscarAtendimento('atend-1', makeUser(Role.ADMIN));

    expect(atendimento.temComprovante).toBe(true);
    expect(atendimento.arquivos[0].downloadUrl).toBe('/api/atendimentos-individuais/arquivos/arq-1/download');
    expect(atendimento.arquivos[0].urlArquivo).toBeUndefined();
  });

  it('deve permitir ADMIN remover anexo por exclusao logica', async () => {
    prisma.arquivoAtendimentoIndividual.findUnique.mockResolvedValue({
      id: 'arq-1',
      atendimentoId: 'atend-1',
      nomeOriginal: 'atestado.pdf',
      urlArquivo: 'https://res.cloudinary.com/demo/raw/upload/atestado.pdf',
      tipoArquivo: 'application/pdf',
      tamanho: 2048,
      categoria: CategoriaArquivoAtendimentoIndividual.ATESTADO,
      criadoPorId: 'prof-1',
      excluidoEm: null,
      atendimento: {
        alunoId: 'aluno-1',
        professorId: 'prof-1',
        acompanhamento: {
          id: 'acomp-1',
          alunoId: 'aluno-1',
          professorId: 'prof-1',
        },
      },
    });
    prisma.arquivoAtendimentoIndividual.update.mockResolvedValue({
      id: 'arq-1',
      nomeOriginal: 'atestado.pdf',
      urlArquivo: 'https://res.cloudinary.com/demo/raw/upload/atestado.pdf',
      tipoArquivo: 'application/pdf',
      categoria: CategoriaArquivoAtendimentoIndividual.ATESTADO,
      excluidoEm: new Date('2026-05-09T12:00:00Z'),
      excluidoPorId: 'user-1',
      motivoExclusao: 'Duplicado',
    });

    const result = await service.arquivarArquivoAtendimento('arq-1', 'Duplicado', makeUser(Role.ADMIN), makeAudit());

    expect(prisma.arquivoAtendimentoIndividual.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        excluidoPorId: 'user-1',
        motivoExclusao: 'Duplicado',
      }),
    }));
    expect(result.urlArquivo).toBeUndefined();
    expect(auditService.registrar).toHaveBeenCalledWith(expect.objectContaining({
      entidade: 'ArquivoAtendimentoIndividual',
      registroId: 'arq-1',
      acao: AuditAcao.ARQUIVAR,
    }));
  });

  it('deve impedir professor remover anexo criado por outro usuario', async () => {
    prisma.arquivoAtendimentoIndividual.findUnique.mockResolvedValue({
      id: 'arq-1',
      atendimentoId: 'atend-1',
      categoria: CategoriaArquivoAtendimentoIndividual.ATESTADO,
      tipoArquivo: 'application/pdf',
      criadoPorId: 'outro-prof',
      excluidoEm: null,
      atendimento: {
        alunoId: 'aluno-1',
        professorId: 'prof-1',
        acompanhamento: {
          id: 'acomp-1',
          alunoId: 'aluno-1',
          professorId: 'prof-1',
        },
      },
    });

    await expect(
      service.arquivarArquivoAtendimento('arq-1', 'Duplicado', makeUser(Role.PROFESSOR, 'prof-1'), makeAudit('prof-1')),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.arquivoAtendimentoIndividual.update).not.toHaveBeenCalled();
  });

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

  it('deve rejeitar upload com MIME invalido', async () => {
    const fakeAtendimento = {
      id: 'atend-1',
      acompanhamento: { id: 'acomp-1', professorId: 'prof-1' },
      arquivos: [],
    };
    prisma.atendimentoIndividual.findFirst.mockResolvedValue(fakeAtendimento);

    const invalidFile = {
      originalname: 'atestado.pdf',
      mimetype: 'text/plain',
      buffer: Buffer.from('%PDF-FAKE'),
      size: 9,
    } as Express.Multer.File;

    await expect(
      service.anexarArquivo('atend-1', invalidFile, 'OUTRO' as any, makeUser(Role.ADMIN), makeAudit()),
    ).rejects.toThrow(BadRequestException);
  });

  it('deve rejeitar upload com extensao invalida', async () => {
    const fakeAtendimento = {
      id: 'atend-1',
      acompanhamento: { id: 'acomp-1', professorId: 'prof-1' },
      arquivos: [],
    };
    prisma.atendimentoIndividual.findFirst.mockResolvedValue(fakeAtendimento);

    const invalidFile = {
      originalname: 'script.exe',
      mimetype: 'application/pdf',
      buffer: Buffer.from('%PDF-FAKE'),
      size: 9,
    } as Express.Multer.File;

    await expect(
      service.anexarArquivo('atend-1', invalidFile, 'OUTRO' as any, makeUser(Role.ADMIN), makeAudit()),
    ).rejects.toThrow(BadRequestException);
  });
});
