import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

const sanitizeString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.replace(/\0/g, '').trim() : value;

/**
 * Apenas motivo e arquivoUrl sao editaveis no PATCH de atestado.
 *
 * Como o ValidationPipe global usa forbidNonWhitelisted, tentativas de enviar
 * dataInicio ou dataFim serao rejeitadas em vez de ignoradas silenciosamente.
 */
export class UpdateAtestadoDto {
  @ApiPropertyOptional({ description: 'Motivo do atestado', example: 'Consulta medica' })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'motivo deve ter no maximo 500 caracteres.' })
  @Transform(sanitizeString)
  motivo?: string;

  @ApiPropertyOptional({ description: 'URL do arquivo PDF/imagem ja enviado ao Cloudinary' })
  @IsOptional()
  @IsUrl({ require_protocol: false, require_tld: false }, { message: 'arquivoUrl deve ser uma URL valida.' })
  @MaxLength(2000, { message: 'arquivoUrl deve ter no maximo 2000 caracteres.' })
  arquivoUrl?: string;
}
