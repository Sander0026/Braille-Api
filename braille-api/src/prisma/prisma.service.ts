import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient<Prisma.PrismaClientOptions, 'query' | 'info' | 'warn' | 'error'> implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);

    constructor() {
        super({
            log: [
                { emit: 'event', level: 'query' },
                { emit: 'event', level: 'error' },
                { emit: 'event', level: 'info' },
                { emit: 'event', level: 'warn' },
            ],
        });
    }

    async onModuleInit() {
        await this.$connect();

        this.$on('error', (event) => {
            this.logger.error(`[Prisma Query Engine ERROR] ${event.message}`, event.target);
        });

        this.$on('warn', (event) => {
            this.logger.warn(`[Prisma Query Engine WARN] ${event.message}`, event.target);
        });

        // Opcional para eventos de conexao
        this.$on('info', (event) => {
            this.logger.log(`[Prisma Engine] ${event.message}`);
        });

        // Descomente abaixo se precisar debugar Performance/Slow Queries
        // this.$on('query', (event) => {
        //     this.logger.debug(`[Prisma Query] ${event.query} | Params: ${event.params} | Duration: ${event.duration}ms`);
        // });
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }
}
