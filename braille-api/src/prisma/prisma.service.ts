import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

/**
 * PrismaService — Singleton gerenciado pelo NestJS.
 *
 * Responsabilidades (SRP):
 *  - Gerenciar o ciclo de vida da conexão com o banco de dados.
 *  - Rotear logs do Prisma Query Engine para o Logger padronizado do NestJS.
 *
 * Regras de segurança:
 *  - Logs de `query` (com parâmetros sensíveis) são ativados APENAS fora de produção.
 *  - Listeners de evento são registrados no constructor (antes do $connect)
 *    para capturar erros que possam ocorrer durante a própria conexão.
 */
@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, 'query' | 'info' | 'warn' | 'error'>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {

    // Logs de `query` carregam parâmetros potencialmente sensíveis (CPF, hashes de senha).
    // Ativados apenas em desenvolvimento para análise de performance e debug.
    const logConfig: Prisma.LogDefinition[] = [
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn'  },
      { emit: 'event', level: 'info'  },
      // Logs de 'query' foram desabilitados para manter o console limpo.
    ];

    super({ log: logConfig });

    // ── Listeners registrados no constructor (antes do $connect) ──────────
    // Garante que erros emitidos DURANTE a conexão também sejam capturados.

    this.$on('error', (event) => {
      // Ignora erro benigno de Idle Timeout Connection droppado pelo PgBouncer/Neon
      if (event.message.includes('kind: Closed, cause: None')) {
        return;
      }
      // Não expõe `event.target` para o cliente — apenas ao log interno.
      this.logger.error(`[Prisma Engine] ${event.message}`);
    });

    this.$on('warn', (event) => {
      this.logger.warn(`[Prisma Engine] ${event.message}`);
    });

    this.$on('info', (event) => {
      this.logger.log(`[Prisma Engine] ${event.message}`);
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Conexão com o banco de dados estabelecida.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Conexão com o banco de dados encerrada.');
  }
}
