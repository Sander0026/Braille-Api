import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Health Check / Sistema')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  @ApiOperation({ summary: 'Mensagem de boas vindas à API.' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({ summary: 'Monitoramento de integridade e comunicação de banco (Ping-Render).' })
  async goHealthCheck() {
    return this.appService.checkHealth();
  }
}
