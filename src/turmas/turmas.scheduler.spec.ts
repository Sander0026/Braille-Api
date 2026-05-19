import { TurmaStatus } from '@prisma/client';
import { TurmasScheduler } from './turmas.scheduler';

describe('TurmasScheduler', () => {
  it('atualiza statusAtivo junto com o status academico automatico', async () => {
    const prisma = {
      turma: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const scheduler = new TurmasScheduler(prisma as never);

    await scheduler.atualizarStatusPorData();

    expect(prisma.turma.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ status: TurmaStatus.PREVISTA }),
        data: { status: TurmaStatus.ANDAMENTO, statusAtivo: true },
      }),
    );
    expect(prisma.turma.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ status: TurmaStatus.ANDAMENTO }),
        data: { status: TurmaStatus.CONCLUIDA, statusAtivo: false },
      }),
    );
  });
});
