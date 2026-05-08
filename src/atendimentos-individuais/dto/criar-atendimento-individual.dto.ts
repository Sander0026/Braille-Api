import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoRegistroAtendimentoIndividual } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const sanitizeString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.replace(/\0/g, '').trim() : value;

export class CriarAtendimentoIndividualDto {
  @ApiProperty({ enum: TipoRegistroAtendimentoIndividual, example: TipoRegistroAtendimentoIndividual.ATENDIMENTO_REALIZADO })
  @IsEnum(TipoRegistroAtendimentoIndividual)
  tipoRegistro: TipoRegistroAtendimentoIndividual;

  @ApiProperty({ example: '2026-05-08' })
  @IsDateString({}, { message: 'dataAtendimento deve ser uma data valida no formato ISO 8601.' })
  @IsNotEmpty()
  dataAtendimento: string;

  @ApiPropertyOptional({ example: 'Leitura e escrita em Braille' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(sanitizeString)
  assuntoDoDia?: string;

  @ApiPropertyOptional({ example: 'Aluno compareceu e realizou as atividades propostas.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(sanitizeString)
  observacao?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(sanitizeString)
  evolucao?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(sanitizeString)
  dificuldades?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(sanitizeString)
  pendencias?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(sanitizeString)
  recomendacoes?: string;
}
