import { IsString, IsNotEmpty, IsOptional, IsDateString, MaxLength, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

const sanitizeString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.replace(/\0/g, '').trim() : value;

export class CreateAtestadoDto {
  @ApiProperty({ description: 'Primeiro dia coberto pelo atestado', example: '2026-03-18' })
  @IsDateString({}, { message: 'dataInicio deve ser uma data válida no formato ISO 8601 (ex: 2026-03-18).' })
  @IsNotEmpty()
  dataInicio: string;

  @ApiProperty({ description: 'Último dia coberto pelo atestado', example: '2026-03-20' })
  @IsDateString({}, { message: 'dataFim deve ser uma data válida no formato ISO 8601 (ex: 2026-03-20).' })
  @IsNotEmpty()
  dataFim: string;

  @ApiProperty({ description: 'Motivo do atestado', example: 'Consulta Médica' })
  @IsString()
  @IsNotEmpty({ message: 'motivo não pode ser vazio.' })
  @MaxLength(500, { message: 'motivo deve ter no máximo 500 caracteres.' })
  @Transform(sanitizeString)
  motivo: string;

  /**
   * URL do arquivo (PDF/imagem) já enviado ao Cloudinary.
   * Validação permissiva (require_protocol: false) para aceitar URLs relativas
   * e protocolos variados do Cloudinary sem breaking changes.
   */
  @ApiPropertyOptional({ description: 'URL do arquivo (PDF/imagem) já enviado ao Cloudinary' })
  @IsOptional()
  @IsUrl({ require_protocol: false, require_tld: false }, { message: 'arquivoUrl deve ser uma URL válida.' })
  @MaxLength(2000, { message: 'arquivoUrl deve ter no máximo 2000 caracteres.' })
  arquivoUrl?: string;
}
