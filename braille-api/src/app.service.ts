import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly prisma: PrismaService) { }

  getHello(): string {
    return 'Bem-vindo à API do Instituto Luiz Braille!';
  }

  async checkHealth() {
    try {
      // Tenta um ping cru e ultra-leve no banco de dados para aferir conexão
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      this.logger.error(`O banco NeonDB falhou a tentar responder ao Ping.`, error.stack);
      throw new HttpException({
        status: 'error',
        database: 'disconnected',
        details: 'A conexão com o NeonDB falhou.',
        timestamp: new Date().toISOString()
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
