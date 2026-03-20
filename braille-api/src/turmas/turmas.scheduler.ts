import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { TurmaStatus } from '@prisma/client';

@Injectable()
export class TurmasScheduler {
  private readonly logger = new Logger(TurmasScheduler.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Executa todo dia à meia-noite (00:00 no fuso de Brasília).
   * Regras:
   *  1. PREVISTA  + dataInicio <= hoje  → ANDAMENTO
   *  2. ANDAMENTO + dataFim    <  hoje  → CONCLUIDA
   */
  @Cron('0 0 * * *', { timeZone: 'America/Sao_Paulo' })
  async atualizarStatusPorData() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    this.logger.log(`[TurmasScheduler] Iniciando verificação de status — ${hoje.toISOString()}`);

    // ── 1. PREVISTA → ANDAMENTO ────────────────────────────────────────────
    const iniciarResult = await this.prisma.turma.updateMany({
      where: {
        status: TurmaStatus.PREVISTA,
        dataInicio: { lte: hoje },   // dataInicio <= hoje
      },
      data: { status: TurmaStatus.ANDAMENTO },
    });

    if (iniciarResult.count > 0) {
      this.logger.log(
        `[TurmasScheduler] ${iniciarResult.count} turma(s) alterada(s): PREVISTA → ANDAMENTO`,
      );
    }

    // ── 2. ANDAMENTO → CONCLUIDA ───────────────────────────────────────────
    const concluirResult = await this.prisma.turma.updateMany({
      where: {
        status: TurmaStatus.ANDAMENTO,
        dataFim: { lt: hoje },       // dataFim < hoje (já encerrou)
      },
      data: { status: TurmaStatus.CONCLUIDA },
    });

    if (concluirResult.count > 0) {
      this.logger.log(
        `[TurmasScheduler] ${concluirResult.count} turma(s) alterada(s): ANDAMENTO → CONCLUIDA`,
      );
    }

    this.logger.log('[TurmasScheduler] Verificação concluída.');
  }
}
