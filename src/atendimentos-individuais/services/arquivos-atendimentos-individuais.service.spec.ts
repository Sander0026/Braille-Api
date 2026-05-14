import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditAcao, CategoriaArquivoAtendimentoIndividual, Role } from '@prisma/client';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../../upload/upload.service';
import { AtendimentosIndividuaisPolicy } from '../policies/atendimentos-individuais.policy';
import { ArquivosAtendimentosIndividuaisService } from './arquivos-atendimentos-individuais.service';
import { AtendimentosIndividuaisAuditService } from './atendimentos-individuais-audit.service';
import { AtendimentosIndividuaisSanitizerService } from './atendimentos-individuais-sanitizer.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import type { AuditUser } from '../../common/interfaces/audit-user.interface';

// ─── Helpers ────────────────────────────────────────────────────────────

function makeUser(role: Role, sub = 'user-1'): AuthenticatedUser {
  return { sub, role, nome: 'Teste' };
}

function makeAudit(sub = 'user-1'): AuditUser {
  return { sub, nome: 'Teste', role: Role.ADMIN };
}

// ─── Suite ──────────────────────────────────────────────────────────────

describe('ArquivosAtendimentosIndividuaisService', () => {
  let service: ArquivosAtendimentosIndividuaisService;

  const prisma = {
    atendimentoIndividual: {
      findFirst: jest.fn(),
    },
    arquivoAtendimentoIndividual: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const auditService = {
    registrar: jest.fn().mockResolvedValue(undefined),
  };

  const uploadService = {
    uploadArquivoAtendimento: jest.fn(),
  };

  const policy = new AtendimentosIndividuaisPolicy();
  const sanitizer = new AtendimentosIndividuaisSanitizerService();

  beforeEach(() => {
    jest.clearAllMocks();
    const audit = new AtendimentosIndividuaisAuditService(auditService as unknown as AuditLogService);
    service = new ArquivosAtendimentosIndividuaisService(
      prisma as unknown as PrismaService,
      uploadService as unknown as UploadService,
      policy,
      sanitizer,
      audit,
    );
  });

  // ─── 1. Download com auditoria ──────────────────────────────────────

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
        acompanhamento: { id: 'acomp-1', alunoId: 'aluno-1', professorId: 'prof-1' },
      },
    });

    const arquivo = await service.obterParaDownload('arq-1', makeUser(Role.ADMIN), makeAudit());

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

  // ─── 2. Download bloqueado para professor sem permissão ─────────────

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
        acompanhamento: { id: 'acomp-1', alunoId: 'aluno-1', professorId: 'prof-outro' },
      },
    });

    await expect(
      service.obterParaDownload('arq-1', makeUser(Role.PROFESSOR, 'prof-1'), makeAudit()),
    ).rejects.toThrow(ForbiddenException);
    expect(auditService.registrar).not.toHaveBeenCalledWith(expect.objectContaining({ acao: AuditAcao.DOWNLOAD }));
  });

  // ─── 3. ADMIN remove anexo por exclusão lógica ──────────────────────

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
        acompanhamento: { id: 'acomp-1', alunoId: 'aluno-1', professorId: 'prof-1' },
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

    const result = await service.arquivar('arq-1', 'Duplicado', makeUser(Role.ADMIN), makeAudit());

    expect(prisma.arquivoAtendimentoIndividual.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        excluidoPorId: 'user-1',
        motivoExclusao: 'Duplicado',
      }),
    }));
    expect((result as any).urlArquivo).toBeUndefined();
    expect(auditService.registrar).toHaveBeenCalledWith(expect.objectContaining({
      entidade: 'ArquivoAtendimentoIndividual',
      registroId: 'arq-1',
      acao: AuditAcao.ARQUIVAR,
    }));
  });

  // ─── 4. Professor não remove anexo de outro ─────────────────────────

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
        acompanhamento: { id: 'acomp-1', alunoId: 'aluno-1', professorId: 'prof-1' },
      },
    });

    await expect(
      service.arquivar('arq-1', 'Duplicado', makeUser(Role.PROFESSOR, 'prof-1'), makeAudit('prof-1')),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.arquivoAtendimentoIndividual.update).not.toHaveBeenCalled();
  });

  // ─── 5. Upload assinatura inválida ──────────────────────────────────

  it('deve rejeitar upload com assinatura de arquivo invalida', async () => {
    prisma.atendimentoIndividual.findFirst.mockResolvedValue({
      id: 'atend-1',
      acompanhamento: { id: 'acomp-1', professorId: 'prof-1' },
      arquivos: [],
    });

    const invalidFile = {
      originalname: 'malware.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('NOT-A-REAL-PDF-FILE'),
      size: 19,
    } as Express.Multer.File;

    await expect(
      service.anexar('atend-1', invalidFile, 'OUTRO' as any, makeUser(Role.ADMIN), makeAudit()),
    ).rejects.toThrow(BadRequestException);
  });

  // ─── 6. Upload MIME inválido ────────────────────────────────────────

  it('deve rejeitar upload com MIME invalido', async () => {
    prisma.atendimentoIndividual.findFirst.mockResolvedValue({
      id: 'atend-1',
      acompanhamento: { id: 'acomp-1', professorId: 'prof-1' },
      arquivos: [],
    });

    const invalidFile = {
      originalname: 'atestado.pdf',
      mimetype: 'text/plain',
      buffer: Buffer.from('%PDF-FAKE'),
      size: 9,
    } as Express.Multer.File;

    await expect(
      service.anexar('atend-1', invalidFile, 'OUTRO' as any, makeUser(Role.ADMIN), makeAudit()),
    ).rejects.toThrow(BadRequestException);
  });

  // ─── 7. Upload extensão inválida ───────────────────────────────────

  it('deve rejeitar upload com extensao invalida', async () => {
    prisma.atendimentoIndividual.findFirst.mockResolvedValue({
      id: 'atend-1',
      acompanhamento: { id: 'acomp-1', professorId: 'prof-1' },
      arquivos: [],
    });

    const invalidFile = {
      originalname: 'script.exe',
      mimetype: 'application/pdf',
      buffer: Buffer.from('%PDF-FAKE'),
      size: 9,
    } as Express.Multer.File;

    await expect(
      service.anexar('atend-1', invalidFile, 'OUTRO' as any, makeUser(Role.ADMIN), makeAudit()),
    ).rejects.toThrow(BadRequestException);
  });

  // ─── 8. Download de arquivo removido → 404 ──────────────────────────

  it('deve retornar 404 ao tentar download de arquivo removido logicamente', async () => {
    prisma.arquivoAtendimentoIndividual.findUnique.mockResolvedValue({
      id: 'arq-1',
      atendimentoId: 'atend-1',
      nomeOriginal: 'atestado.pdf',
      urlArquivo: 'https://res.cloudinary.com/demo/raw/upload/atestado.pdf',
      tipoArquivo: 'application/pdf',
      tamanho: 2048,
      categoria: CategoriaArquivoAtendimentoIndividual.ATESTADO,
      excluidoEm: new Date('2026-05-09T10:00:00Z'),
      excluidoPorId: 'admin-1',
      motivoExclusao: 'Duplicado',
      atendimento: {
        alunoId: 'aluno-1',
        professorId: 'prof-1',
        acompanhamento: { id: 'acomp-1', alunoId: 'aluno-1', professorId: 'prof-1' },
      },
    });

    await expect(
      service.obterParaDownload('arq-1', makeUser(Role.ADMIN), makeAudit()),
    ).rejects.toThrow(NotFoundException);
    expect(auditService.registrar).not.toHaveBeenCalled();
  });

  // ─── 9. Auditoria de download NÃO inclui urlArquivo ─────────────────

  it('deve registrar download na auditoria sem expor urlArquivo', async () => {
    prisma.arquivoAtendimentoIndividual.findUnique.mockResolvedValue({
      id: 'arq-1',
      atendimentoId: 'atend-1',
      nomeOriginal: 'laudo.pdf',
      urlArquivo: 'https://res.cloudinary.com/demo/raw/upload/laudo.pdf',
      tipoArquivo: 'application/pdf',
      tamanho: 4096,
      categoria: CategoriaArquivoAtendimentoIndividual.LAUDO,
      excluidoEm: null,
      atendimento: {
        alunoId: 'aluno-1',
        professorId: 'prof-1',
        acompanhamento: { id: 'acomp-1', alunoId: 'aluno-1', professorId: 'prof-1' },
      },
    });

    await service.obterParaDownload('arq-1', makeUser(Role.ADMIN), makeAudit());

    const callArgs = auditService.registrar.mock.calls[0][0];
    expect(callArgs.newValue).not.toHaveProperty('urlArquivo');
    expect(callArgs.newValue).toHaveProperty('arquivoId', 'arq-1');
    expect(callArgs.newValue).toHaveProperty('categoria', CategoriaArquivoAtendimentoIndividual.LAUDO);
  });
});
