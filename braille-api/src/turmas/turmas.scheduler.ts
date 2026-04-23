import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { TurmaStatus } from '@prisma/client';

@Injectable()
export class TurmasScheduler {
  private readonly logger = new Logger(TurmasScheduler.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 0 * * *', { timeZone: 'America/Sao_Paulo' })
  async atualizarStatusPorData() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    this.logger.log(`[TurmasScheduler] Iniciando verificação de status — ${hoje.toISOString()}`);

    try {
      const iniciarResult = await this.prisma.turma.updateMany({
        where: {
          status: TurmaStatus.PREVISTA,
          dataInicio: { lte: hoje },
        },
        data: { status: TurmaStatus.ANDAMENTO },
      });

      if (iniciarResult.count > 0) {
        this.logger.log(`[TurmasScheduler] ${iniciarResult.count} turma(s) alterada(s): PREVISTA → ANDAMENTO`);
      }

      const concluirResult = await this.prisma.turma.updateMany({
        where: {
          status: TurmaStatus.ANDAMENTO,
          dataFim: { lt: hoje },
        },
        data: { status: TurmaStatus.CONCLUIDA },
      });

      if (concluirResult.count > 0) {
        this.logger.log(`[TurmasScheduler] ${concluirResult.count} turma(s) alterada(s): ANDAMENTO → CONCLUIDA`);
      }

      this.logger.log('[TurmasScheduler] Verificação concluída com sucesso.');
    } catch (err: any) {
      this.logger.error(`[TurmasScheduler] Falha fatal interrompeu a verificação do BD: ${err.message}`, err.stack);
    }
  }
}
