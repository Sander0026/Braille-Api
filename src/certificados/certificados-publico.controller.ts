import { Controller, Get, Param, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { CertificadosService } from './certificados.service';

@ApiTags('Portal de Validação Pública')
@Controller('certificados')
export class CertificadosPublicoController {
  constructor(private readonly certificadosService: CertificadosService) {}

  @Get('validar/:codigo')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60000)
  @ApiOperation({ summary: 'Valida a autenticidade de um certificado pelo código único' })
  @ApiParam({ name: 'codigo', description: 'Codigo unico de validacao impresso no certificado ou lido via QR Code' })
  @ApiResponse({ status: 200, description: 'Resultado publico da validacao do certificado.' })
  async validar(@Param('codigo') codigo: string) {
    return this.certificadosService.validarPublico(codigo);
  }
}
