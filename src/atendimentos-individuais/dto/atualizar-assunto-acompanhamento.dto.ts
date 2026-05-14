import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const sanitizeString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.replace(/\0/g, '').trim() : value;

export class AtualizarAssuntoAcompanhamentoDto {
  @ApiProperty({ example: 'Orientacao e mobilidade' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(sanitizeString)
  assuntoAtual: string;

  @ApiPropertyOptional({ example: 'Ajuste de foco apos avaliacao pedagogica.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(sanitizeString)
  motivoAlteracao?: string;
}
