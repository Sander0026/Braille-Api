import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CategoriaArquivoAtendimentoIndividual, Role, StatusAcompanhamentoIndividual, TipoRegistroAtendimentoIndividual } from '@prisma/client';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AtendimentosIndividuaisPolicy } from '../policies/atendimentos-individuais.policy';
import { AtendimentosIndividuaisRegistrosService } from './atendimentos-individuais-registros.service';
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

function makeAcompanhamento(overrides: Record<string, unknown> = {}) {
  return {
    id: 'acomp-1',
    alunoId: 'aluno-1',
    professorId: 'prof-1',
    assuntoAtual: 'Braille basico',
    status: StatusAcompanhamentoIndividual.EM_ANDAMENTO,
    arquivado: false,
    dataInicio: new Date(),
    excluidoEm: null,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    ...overrides,
  };
}

// ─── Suite ──────────────────────────────────────────────────────────────

describe('AtendimentosIndividuaisRegistrosService', () => {
  let service: AtendimentosIndividuaisRegistrosService;

  const prisma = {
    acompanhamentoIndividual: {
      findFirst: jest.fn(),
    },
    atendimentoIndividual: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };

  const auditService = {
    registrar: jest.fn().mockResolvedValue(undefined),
  };

  const policy = new AtendimentosIndividuaisPolicy();
  const sanitizer = new AtendimentosIndividuaisSanitizerService();

  beforeEach(() => {
    jest.clearAllMocks();
    const audit = new AtendimentosIndividuaisAuditService(auditService as unknown as AuditLogService);
    service = new AtendimentosIndividuaisRegistrosService(
      prisma as unknown as PrismaService,
      policy,
      sanitizer,
      audit,
    );
  });

  // ─── 1. SECRETARIA não pode criar atendimento ─────────────────────

  it('deve impedir SECRETARIA de criar atendimento', async () => {
    prisma.acompanhamentoIndividual.findFirst.mockResolvedValue(makeAcompanhamento());

    await expect(
      service.criar('acomp-1', {
        tipoRegistro: TipoRegistroAtendimentoIndividual.FALTA_NAO_JUSTIFICADA,
        dataAtendimento: '2026-05-08',
      } as any, makeUser(Role.SECRETARIA), makeAudit()),
    ).rejects.toThrow(ForbiddenException);
  });

  // ─── 2. horaFim < horaInicio retorna BadRequestException ──────────

  it('deve rejeitar quando horaFim e menor que horaInicio', async () => {
    prisma.acompanhamentoIndividual.findFirst.mockResolvedValue(makeAcompanhamento());

    await expect(
      service.criar('acomp-1', {
        tipoRegistro: TipoRegistroAtendimentoIndividual.FALTA_NAO_JUSTIFICADA,
        dataAtendimento: '2026-05-08',
        horaInicio: '14:00',
        horaFim: '13:00',
      } as any, makeUser(Role.ADMIN), makeAudit()),
    ).rejects.toThrow(BadRequestException);
  });

  // ─── 3. Duração calculada automaticamente ─────────────────────────

  it('deve calcular duracaoMinutos quando horaInicio e horaFim existem', async () => {
    prisma.acompanhamentoIndividual.findFirst.mockResolvedValue(makeAcompanhamento());
    prisma.atendimentoIndividual.create.mockResolvedValue({
      id: 'atend-1',
      acompanhamentoId: 'acomp-1',
      alunoId: 'aluno-1',
      professorId: 'prof-1',
      tipoRegistro: TipoRegistroAtendimentoIndividual.ATENDIMENTO_REALIZADO,
      dataAtendimento: new Date('2026-05-08'),
      horaInicioMinutos: 480,
      horaFimMinutos: 570,
      duracaoMinutos: 90,
      arquivos: [],
    });

    await service.criar('acomp-1', {
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
          horaInicioMinutos: 480,
          horaFimMinutos: 570,
          duracaoMinutos: 90,
        }),
      }),
    );
  });

  // ─── 4. Modalidade e local persistidos ────────────────────────────

  it('deve salvar modalidade e localAtendimento ao criar atendimento', async () => {
    prisma.acompanhamentoIndividual.findFirst.mockResolvedValue(makeAcompanhamento());
    prisma.atendimentoIndividual.create.mockResolvedValue({
      id: 'atend-1',
      tipoRegistro: TipoRegistroAtendimentoIndividual.FALTA_NAO_JUSTIFICADA,
      dataAtendimento: new Date('2026-05-08'),
      modalidade: 'PRESENCIAL',
      localAtendimento: 'Sala 2',
      arquivos: [],
    });

    await service.criar('acomp-1', {
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

  // ─── 5. Duração manual ────────────────────────────────────────────

  it('deve usar duracaoMinutos do DTO quando horaInicio e horaFim nao informados', async () => {
    prisma.acompanhamentoIndividual.findFirst.mockResolvedValue(makeAcompanhamento());
    prisma.atendimentoIndividual.create.mockResolvedValue({
      id: 'atend-1',
      tipoRegistro: TipoRegistroAtendimentoIndividual.FALTA_NAO_JUSTIFICADA,
      dataAtendimento: new Date('2026-05-08'),
      duracaoMinutos: 45,
      arquivos: [],
    });

    await service.criar('acomp-1', {
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

  // ─── 6. Falta justificada com comprovante ─────────────────────────

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

    const atendimento = await service.buscar('atend-1', makeUser(Role.ADMIN));

    expect(atendimento.temComprovante).toBe(true);
    expect(atendimento.arquivos[0].downloadUrl).toBe('/api/atendimentos-individuais/arquivos/arq-1/download');
    expect((atendimento.arquivos[0] as any).urlArquivo).toBeUndefined();
  });
});
