import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CertificadosService } from './certificados.service';

@ApiTags('Portal de Validação Pública')
@Controller('certificados')
export class CertificadosPublicoController {
  constructor(private readonly certificadosService: CertificadosService) {}

  @Get('validar/:codigo')
  @ApiOperation({ summary: 'Valida a autenticidade de um certificado pelo código único' })
  async validar(@Param('codigo') codigo: string) {
    return this.certificadosService.validarPublico(codigo);
  }
}
