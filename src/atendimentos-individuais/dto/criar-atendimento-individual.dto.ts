import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ModalidadeAtendimentoIndividual, TipoRegistroAtendimentoIndividual } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

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

  @ApiPropertyOptional({ example: '08:00', description: 'Horario de inicio no formato HH:mm.' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'horaInicio deve estar no formato HH:mm.' })
  horaInicio?: string;

  @ApiPropertyOptional({ example: '09:30', description: 'Horario de fim no formato HH:mm.' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'horaFim deve estar no formato HH:mm.' })
  horaFim?: string;

  @ApiPropertyOptional({ example: 90, description: 'Duracao do atendimento em minutos.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  duracaoMinutos?: number;

  @ApiPropertyOptional({ enum: ModalidadeAtendimentoIndividual, example: ModalidadeAtendimentoIndividual.PRESENCIAL })
  @IsOptional()
  @IsEnum(ModalidadeAtendimentoIndividual)
  modalidade?: ModalidadeAtendimentoIndividual;

  @ApiPropertyOptional({ example: 'Sala de atendimento 2' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(sanitizeString)
  localAtendimento?: string;

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
