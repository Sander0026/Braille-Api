import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiOperation, ApiTags, ApiOkResponse, ApiInternalServerErrorResponse } from '@nestjs/swagger';

@ApiTags('Health Check / Sistema')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Mensagem de boas vindas à API.' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({ summary: 'Monitoramento de integridade e comunicação de banco (Ping-Render).' })
  @ApiOkResponse({
    description: 'A API está ativa e o Banco de Dados responde com integridade.',
    schema: { example: { status: 'ok', database: 'connected', timestamp: '2026-03-31T00:00:00.000Z' } },
  })
  @ApiInternalServerErrorResponse({
    description: 'Falha fatal na comunicação com o PostgreSQL (Neon).',
    schema: {
      example: {
        status: 'error',
        database: 'disconnected',
        details: 'A conexão com o NeonDB falhou.',
        timestamp: '2026-03-31T00:00:00.000Z',
      },
    },
  })
  async goHealthCheck() {
    return this.appService.checkHealth();
  }
}
