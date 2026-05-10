import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditAcao, CategoriaArquivoAtendimentoIndividual, Role, StatusAcompanhamentoIndividual, TipoRegistroAtendimentoIndividual } from '@prisma/client';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';

import { AtendimentosIndividuaisPolicy } from '../policies/atendimentos-individuais.policy';
import { AtendimentosIndividuaisService } from './atendimentos-individuais.service';
import { AtendimentosIndividuaisAuditService } from './atendimentos-individuais-audit.service';
import { AtendimentosIndividuaisSanitizerService } from './atendimentos-individuais-sanitizer.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import type { AuditUser } from '../../common/interfaces/audit-user.interface';
import { STATUS_ARQUIVADO_VIRTUAL } from '../dto/filtro-acompanhamento-individual.dto';

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
    arquivado: false,
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



  const policy = new AtendimentosIndividuaisPolicy();
  const sanitizer = new AtendimentosIndividuaisSanitizerService();

  beforeEach(() => {
    jest.clearAllMocks();
    const audit = new AtendimentosIndividuaisAuditService(auditService as unknown as AuditLogService);
    service = new AtendimentosIndividuaisService(
      prisma as unknown as PrismaService,
      policy,
      sanitizer,
      audit,
    );
  });

  // ─── 1. ADMIN arquiva EM_ANDAMENTO ─────────────────────────────────

  it('deve permitir ADMIN arquivar acompanhamento EM_ANDAMENTO sem alterar status pedagogico', async () => {
    const original = makeAcompanhamento({ status: StatusAcompanhamentoIndividual.EM_ANDAMENTO });
    prisma.acompanhamentoIndividual.findFirst.mockResolvedValue(original);
    prisma.acompanhamentoIndividual.update.mockResolvedValue({
      ...original,
      arquivado: true,
    });

    const result = await service.arquivarAcompanhamento('acomp-1', 'Aluno transferido.', makeUser(Role.ADMIN), makeAudit());

    expect(prisma.acompanhamentoIndividual.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          arquivado: true,
          arquivadoPorId: 'user-1',
        }),
      }),
    );
    expect(result.status).toBe(STATUS_ARQUIVADO_VIRTUAL);
  });

  // ─── 2. ADMIN arquiva FINALIZADO ───────────────────────────────────

  it('deve permitir ADMIN arquivar acompanhamento FINALIZADO sem alterar status pedagogico', async () => {
    const original = makeAcompanhamento({ status: StatusAcompanhamentoIndividual.FINALIZADO });
    prisma.acompanhamentoIndividual.findFirst.mockResolvedValue(original);
    prisma.acompanhamentoIndividual.update.mockResolvedValue({
      ...original,
      arquivado: true,
    });

    const result = await service.arquivarAcompanhamento('acomp-1', 'Aluno transferido.', makeUser(Role.ADMIN), makeAudit());

    expect(prisma.acompanhamentoIndividual.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          arquivado: true,
          arquivadoPorId: 'user-1',
        }),
      }),
    );
    expect(result.status).toBe(STATUS_ARQUIVADO_VIRTUAL);
  });

  // ─── 3. Desarquivar FINALIZADO → volta FINALIZADO ─────────────────

  it('deve restaurar status FINALIZADO ao desarquivar acompanhamento que era FINALIZADO', async () => {
    const original = makeAcompanhamento({ status: StatusAcompanhamentoIndividual.FINALIZADO, arquivado: true });
    prisma.acompanhamentoIndividual.findFirst.mockResolvedValue(original);
    prisma.acompanhamentoIndividual.update.mockResolvedValue({
      ...original,
      status: StatusAcompanhamentoIndividual.FINALIZADO,
      arquivado: false,
    });

    const result = await service.desarquivarAcompanhamento('acomp-1', 'Aluno retornou.', makeUser(Role.ADMIN), makeAudit());

    expect(prisma.acompanhamentoIndividual.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          arquivado: false,
          desarquivadoPorId: 'user-1',
        }),
      }),
    );
    expect(result.status).toBe(StatusAcompanhamentoIndividual.FINALIZADO);
  });

  // ─── 4. Desarquivar EM_ANDAMENTO → volta EM_ANDAMENTO ─────────────

  it('deve restaurar status EM_ANDAMENTO ao desarquivar acompanhamento que era EM_ANDAMENTO', async () => {
    const original = makeAcompanhamento({ status: StatusAcompanhamentoIndividual.EM_ANDAMENTO, arquivado: true });
    prisma.acompanhamentoIndividual.findFirst.mockResolvedValue(original);
    prisma.acompanhamentoIndividual.update.mockResolvedValue({
      ...original,
      status: StatusAcompanhamentoIndividual.EM_ANDAMENTO,
      arquivado: false,
    });

    const result = await service.desarquivarAcompanhamento('acomp-1', 'Aluno retornou.', makeUser(Role.ADMIN), makeAudit());

    expect(result.status).toBe(StatusAcompanhamentoIndividual.EM_ANDAMENTO);
  });

  // ─── 5. Reabrir ARQUIVADO lança ConflictException ─────────────────

  it('nao deve permitir reabrir acompanhamento ARQUIVADO diretamente', async () => {
    const original = makeAcompanhamento({ arquivado: true });
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
      service.arquivarAcompanhamento('acomp-1', 'Motivo teste', makeUser(Role.SECRETARIA), makeAudit()),
    ).rejects.toThrow(ForbiddenException);
  });

  it('deve impedir PROFESSOR de listar acompanhamentos arquivados', async () => {
    await expect(
      service.listarAcompanhamentos(
        { status: STATUS_ARQUIVADO_VIRTUAL } as any,
        makeUser(Role.PROFESSOR, 'prof-1'),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('deve avisar quando existir acompanhamento em andamento duplicado', async () => {
    const original = makeAcompanhamento({
      alunoId: 'aluno-1',
      professorId: 'prof-1',
      assuntoAtual: 'Braille',
      status: StatusAcompanhamentoIndividual.EM_ANDAMENTO,
    });
    prisma.acompanhamentoIndividual.findFirst.mockResolvedValue(original);

    const result = await service.verificarDuplicidadeAcompanhamento(
      { alunoId: 'aluno-1', professorId: 'prof-1', assuntoAtual: 'braille' },
      makeUser(Role.ADMIN),
    );

    expect(result.duplicado).toBe(true);
    expect(result.acompanhamento?.id).toBe('acomp-1');
    expect(prisma.acompanhamentoIndividual.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        alunoId: 'aluno-1',
        professorId: 'prof-1',
        status: StatusAcompanhamentoIndividual.EM_ANDAMENTO,
        assuntoAtual: { equals: 'braille', mode: 'insensitive' },
      }),
    }));
  });

  it('deve impedir SECRETARIA de desarquivar acompanhamento', async () => {
    const original = makeAcompanhamento({ arquivado: true });
    prisma.acompanhamentoIndividual.findFirst.mockResolvedValue(original);

    await expect(
      service.desarquivarAcompanhamento('acomp-1', 'Motivo teste', makeUser(Role.SECRETARIA), makeAudit()),
    ).rejects.toThrow(ForbiddenException);
  });

  // ─── 7. PROFESSOR não pode arquivar ───────────────────────────────

  it('deve impedir PROFESSOR de arquivar acompanhamento', async () => {
    const original = makeAcompanhamento();
    prisma.acompanhamentoIndividual.findFirst.mockResolvedValue(original);

    await expect(
      service.arquivarAcompanhamento('acomp-1', 'Motivo teste', makeUser(Role.PROFESSOR, 'prof-1'), makeAudit()),
    ).rejects.toThrow(ForbiddenException);
  });

  it('deve impedir PROFESSOR de desarquivar acompanhamento', async () => {
    const original = makeAcompanhamento({ arquivado: true });
    prisma.acompanhamentoIndividual.findFirst.mockResolvedValue(original);

    await expect(
      service.desarquivarAcompanhamento('acomp-1', 'Motivo teste', makeUser(Role.PROFESSOR, 'prof-1'), makeAudit()),
    ).rejects.toThrow(ForbiddenException);
  });

  // ─── 8. PROFESSOR não acessa acompanhamento de outro professor ─────

  it('deve impedir PROFESSOR de visualizar acompanhamento de outro professor', async () => {
    const original = makeAcompanhamento({ professorId: 'prof-outro' });
    prisma.acompanhamentoIndividual.findFirst.mockResolvedValue(original);

    await expect(
      service.buscarAcompanhamento('acomp-1', makeUser(Role.PROFESSOR, 'prof-1')),
    ).rejects.toThrow(ForbiddenException);
  });

  // ─── 14. Sanitizer: arquivo removido sem downloadUrl ────────────────

  it('arquivo removido nao deve ter downloadUrl apos sanitizacao', () => {
    const result = sanitizer.sanitizarArquivo({
      id: 'arq-1',
      atendimentoId: 'atend-1',
      nomeOriginal: 'atestado.pdf',
      nomeArquivo: 'atestado.pdf',
      urlArquivo: 'https://res.cloudinary.com/demo/raw/upload/atestado.pdf',
      tipoArquivo: 'application/pdf',
      tamanho: 2048,
      categoria: CategoriaArquivoAtendimentoIndividual.ATESTADO,
      criadoPorId: 'prof-1',
      criadoEm: new Date(),
      excluidoEm: new Date('2026-05-09T10:00:00Z'),
      excluidoPorId: 'admin-1',
      motivoExclusao: 'Duplicado',
    });

    expect(result.downloadUrl).toBeUndefined();
    expect((result as any).urlArquivo).toBeUndefined();
  });

  // ─── 15. Sanitizer: arquivo ativo TEM downloadUrl ──────────────────

  it('arquivo ativo deve ter downloadUrl apos sanitizacao', () => {
    const result = sanitizer.sanitizarArquivo({
      id: 'arq-1',
      atendimentoId: 'atend-1',
      nomeOriginal: 'atestado.pdf',
      nomeArquivo: 'atestado.pdf',
      urlArquivo: 'https://res.cloudinary.com/demo/raw/upload/atestado.pdf',
      tipoArquivo: 'application/pdf',
      tamanho: 2048,
      categoria: CategoriaArquivoAtendimentoIndividual.ATESTADO,
      criadoPorId: 'prof-1',
      criadoEm: new Date(),
      excluidoEm: null,
      excluidoPorId: null,
      motivoExclusao: null,
    });

    expect(result.downloadUrl).toBe('/api/atendimentos-individuais/arquivos/arq-1/download');
    expect((result as any).urlArquivo).toBeUndefined();
  });

  // ─── 22. motivoArquivamento salvo ao arquivar ────────────────────────

  it('deve salvar motivoArquivamento ao arquivar acompanhamento', async () => {
    const original = makeAcompanhamento({ status: StatusAcompanhamentoIndividual.EM_ANDAMENTO });
    prisma.acompanhamentoIndividual.findFirst.mockResolvedValue(original);
    prisma.acompanhamentoIndividual.update.mockResolvedValue({
      ...original,
      arquivado: true,
      motivoArquivamento: 'Aluno transferido para outra escola.',
    });

    await service.arquivarAcompanhamento('acomp-1', 'Aluno transferido para outra escola.', makeUser(Role.ADMIN), makeAudit());

    expect(prisma.acompanhamentoIndividual.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          arquivado: true,
          motivoArquivamento: 'Aluno transferido para outra escola.',
          motivoDesarquivamento: null,
        }),
      }),
    );
  });

  // ─── 23. motivoDesarquivamento salvo ao desarquivar ──────────────────

  it('deve salvar motivoDesarquivamento ao desarquivar acompanhamento', async () => {
    const original = makeAcompanhamento({ status: StatusAcompanhamentoIndividual.FINALIZADO, arquivado: true });
    prisma.acompanhamentoIndividual.findFirst.mockResolvedValue(original);
    prisma.acompanhamentoIndividual.update.mockResolvedValue({
      ...original,
      arquivado: false,
      motivoDesarquivamento: 'Revisao administrativa necessaria.',
    });

    await service.desarquivarAcompanhamento('acomp-1', 'Revisao administrativa necessaria.', makeUser(Role.ADMIN), makeAudit());

    expect(prisma.acompanhamentoIndividual.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          arquivado: false,
          motivoDesarquivamento: 'Revisao administrativa necessaria.',
        }),
      }),
    );
  });
});
