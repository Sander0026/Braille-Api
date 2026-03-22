import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateAtestadoDto {
  @ApiPropertyOptional({ description: 'Motivo da ausência (ex: Consulta Médica)' })
  @IsOptional()
  @IsString()
  motivo?: string;

  @ApiPropertyOptional({ description: 'Nova URL do arquivo do atestado (ex: Cloudinary)' })
  @IsOptional()
  @IsString()
  arquivoUrl?: string;
}
