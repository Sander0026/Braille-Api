import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAtestadoDto {
  @ApiProperty({ description: 'Primeiro dia coberto pelo atestado', example: '2026-03-18' })
  @IsDateString()
  @IsNotEmpty()
  dataInicio: string;

  @ApiProperty({ description: 'Último dia coberto pelo atestado', example: '2026-03-20' })
  @IsDateString()
  @IsNotEmpty()
  dataFim: string;

  @ApiProperty({ description: 'Motivo do atestado', example: 'Consulta Médica' })
  @IsString()
  @IsNotEmpty()
  motivo: string;

  @ApiPropertyOptional({ description: 'URL do arquivo (PDF/imagem) já enviado ao Cloudinary' })
  @IsString()
  @IsOptional()
  arquivoUrl?: string;
}
