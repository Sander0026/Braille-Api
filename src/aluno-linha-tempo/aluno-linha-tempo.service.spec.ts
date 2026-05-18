import { BadRequestException } from '@nestjs/common';
import { Role, TipoEventoLinhaTempoAluno } from '@prisma/client';
import { AlunoLinhaTempoService } from './aluno-linha-tempo.service';

const adminUser = {
  sub: 'user-1',
  role: Role.ADMIN,
  nome: 'Secretaria',
};

const professorUser = {
  sub: 'professor-1',
  role: Role.PROFESSOR,
  nome: 'Professor',
};

describe('AlunoLinhaTempoService', () => {
  function criarService() {
    const prisma = {
      aluno: {
        findFirst: jest.fn(),
      },
      turma: {
        findFirst: jest.fn(),
      },
      eventoLinhaTempoAluno: {
        count: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    return {
      prisma,
      service: new AlunoLinhaTempoService(prisma as never),
    };
  }

  it('retorna resumo com totais e ultimas datas por grupo', async () => {
    const { prisma, service } = criarService();
    prisma.aluno.findFirst.mockResolvedValue({ id: 'aluno-1' });
    prisma.eventoLinhaTempoAluno.count.mockResolvedValueOnce(1).mockResolvedValueOnce(4);
    prisma.eventoLinhaTempoAluno.findFirst
      .mockResolvedValueOnce({ dataEvento: new Date('2026-05-10T00:00:00.000Z') })
      .mockResolvedValueOnce({ dataEvento: new Date('2026-05-11T00:00:00.000Z') })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ dataEvento: new Date('2026-05-12T00:00:00.000Z') });

    await expect(service.resumo('aluno-1', adminUser)).resolves.toEqual({
      totalEventos: 4,
      ultimaFrequencia: '2026-05-10T00:00:00.000Z',
      ultimoAtendimento: '2026-05-11T00:00:00.000Z',
      ultimaAcaoRisco: '2026-05-12T00:00:00.000Z',
    });
  });

  it('cria observacao manual vinculando snapshots da turma e do usuario', async () => {
    const { prisma, service } = criarService();
    const dataEvento = new Date('2026-05-13T00:00:00.000Z');
    prisma.aluno.findFirst.mockResolvedValue({ id: 'aluno-1' });
    prisma.turma.findFirst.mockResolvedValue({
      id: 'turma-1',
      nome: 'Braille',
      professor: { nome: 'Professor' },
    });
    prisma.eventoLinhaTempoAluno.create.mockResolvedValue({
      id: 'evento-1',
      alunoId: 'aluno-1',
      turmaId: 'turma-1',
      tipo: TipoEventoLinhaTempoAluno.OBSERVACAO_MANUAL,
      origem: 'MANUAL',
      dataEvento,
      titulo: 'Reuniao com familia',
      descricao: 'Responsavel orientado.',
      turmaNomeSnapshot: 'Braille',
      professorNomeSnapshot: 'Professor',
      usuarioNomeSnapshot: 'Secretaria',
      metadata: { manual: true },
    });

    await expect(
      service.createManual(
        'aluno-1',
        {
          tipo: 'OBSERVACAO_MANUAL',
          dataEvento: '2026-05-13',
          titulo: ' Reuniao com familia ',
          descricao: ' Responsavel orientado. ',
          turmaId: 'turma-1',
        },
        adminUser,
      ),
    ).resolves.toMatchObject({
      id: 'evento-1',
      tipo: TipoEventoLinhaTempoAluno.OBSERVACAO_MANUAL,
      data: '2026-05-13T00:00:00.000Z',
      titulo: 'Reuniao com familia',
      turmaNome: 'Braille',
      professorNome: 'Professor',
      usuarioNome: 'Secretaria',
    });

    expect(prisma.eventoLinhaTempoAluno.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          titulo: 'Reuniao com familia',
          descricao: 'Responsavel orientado.',
          turmaNomeSnapshot: 'Braille',
          professorNomeSnapshot: 'Professor',
          usuarioNomeSnapshot: 'Secretaria',
        }),
      }),
    );
  });

  it('bloqueia remocao de evento que nao seja manual', async () => {
    const { prisma, service } = criarService();
    prisma.aluno.findFirst.mockResolvedValue({ id: 'aluno-1' });
    prisma.eventoLinhaTempoAluno.findFirst.mockResolvedValue({
      id: 'evento-1',
      alunoId: 'aluno-1',
      tipo: TipoEventoLinhaTempoAluno.FREQUENCIA_PRESENTE,
      origem: 'FREQUENCIA',
    });

    await expect(service.removeEventoManual('aluno-1', 'evento-1', adminUser)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.eventoLinhaTempoAluno.delete).not.toHaveBeenCalled();
  });

  it('mascara detalhes sensiveis para professor vinculado ao aluno', async () => {
    const { prisma, service } = criarService();
    const dataEvento = new Date('2026-05-14T00:00:00.000Z');
    prisma.aluno.findFirst
      .mockResolvedValueOnce({ id: 'aluno-1' })
      .mockResolvedValueOnce({ id: 'aluno-1' });
    prisma.eventoLinhaTempoAluno.count.mockResolvedValue(1);
    prisma.$transaction.mockResolvedValue([
      1,
      [
        {
          id: 'evento-1',
          alunoId: 'aluno-1',
          turmaId: null,
          tipo: TipoEventoLinhaTempoAluno.LAUDO,
          origem: 'LAUDO_MEDICO',
          dataEvento,
          titulo: 'Laudo medico registrado',
          descricao: 'CID e observacoes medicas',
          turmaNomeSnapshot: null,
          professorNomeSnapshot: null,
          usuarioNomeSnapshot: 'Secretaria',
          metadata: { medicoResponsavel: 'Dr. Exemplo' },
          sensivel: true,
        },
      ],
    ]);

    await expect(service.findByAluno('aluno-1', {}, professorUser)).resolves.toEqual({
      data: [
        {
          id: 'evento-1',
          tipo: TipoEventoLinhaTempoAluno.LAUDO,
          data: '2026-05-14T00:00:00.000Z',
          titulo: 'Laudo medico registrado.',
          descricao: 'Detalhes restritos a secretaria e administracao.',
          origem: 'LAUDO_MEDICO',
          alunoId: 'aluno-1',
          usuarioNome: 'Secretaria',
          metadata: {
            sensivel: true,
            restrito: true,
          },
        },
      ],
      meta: {
        page: 1,
        limit: 30,
        total: 1,
        lastPage: 1,
      },
    });
  });
});
