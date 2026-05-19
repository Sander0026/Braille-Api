import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MatriculaStatus, MotivoEncerramentoMatricula } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const sanitizeString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.replace(/\0/g, '').trim() : value;

export const STATUS_ENCERRAMENTO_MATRICULA = [
  MatriculaStatus.CONCLUIDA,
  MatriculaStatus.EVADIDA,
  MatriculaStatus.CANCELADA,
  MatriculaStatus.TRANSFERIDA,
] as const;

export type StatusEncerramentoMatricula = (typeof STATUS_ENCERRAMENTO_MATRICULA)[number];

export class EncerrarMatriculaDto {
  @ApiProperty({
    enum: STATUS_ENCERRAMENTO_MATRICULA,
    description: 'Status final da matrícula na turma.',
    example: MatriculaStatus.EVADIDA,
  })
  @IsIn(STATUS_ENCERRAMENTO_MATRICULA)
  status: StatusEncerramentoMatricula;

  @ApiProperty({
    enum: MotivoEncerramentoMatricula,
    description: 'Motivo estruturado do encerramento da matrícula.',
    example: MotivoEncerramentoMatricula.DESISTENCIA_VOLUNTARIA,
  })
  @IsEnum(MotivoEncerramentoMatricula)
  motivoEncerramento: MotivoEncerramentoMatricula;

  @ApiPropertyOptional({ description: 'Observação complementar sobre o encerramento.', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'observacao deve ter no máximo 1000 caracteres.' })
  @Transform(sanitizeString)
  observacao?: string;

  @ApiPropertyOptional({ description: 'Data do encerramento no formato ISO 8601.', example: '2026-05-17' })
  @IsOptional()
  @IsDateString({}, { message: 'dataEncerramento deve ser uma data válida no formato ISO 8601.' })
  dataEncerramento?: string;
}
