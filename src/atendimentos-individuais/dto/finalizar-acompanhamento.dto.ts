import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

const sanitizeString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.replace(/\0/g, '').trim() : value;

export class FinalizarAcompanhamentoDto {
  @ApiPropertyOptional({ example: 'Objetivos principais alcancados.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(sanitizeString)
  resultadoFinal?: string;

  @ApiPropertyOptional({ example: 'Aluno evoluiu na leitura de textos curtos.' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @Transform(sanitizeString)
  resumoFinal?: string;
}
