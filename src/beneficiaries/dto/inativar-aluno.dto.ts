import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MatriculaStatus, MotivoEncerramentoMatricula, MotivoInativacaoAluno } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const sanitizeString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.replace(/\0/g, '').trim() : value;

export const STATUS_INATIVACAO_MATRICULA = [
  MatriculaStatus.EVADIDA,
  MatriculaStatus.CANCELADA,
  MatriculaStatus.TRANSFERIDA,
] as const;

export type StatusInativacaoMatricula = (typeof STATUS_INATIVACAO_MATRICULA)[number];

export class InativarAlunoDto {
  @ApiProperty({
    enum: MotivoInativacaoAluno,
    description: 'Motivo estruturado para inativar o aluno na instituição.',
    example: MotivoInativacaoAluno.EVASAO_INSTITUCIONAL,
  })
  @IsEnum(MotivoInativacaoAluno)
  motivoInativacao: MotivoInativacaoAluno;

  @ApiPropertyOptional({ description: 'Observação complementar sobre a inativação.', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'observacao deve ter no máximo 1000 caracteres.' })
  @Transform(sanitizeString)
  observacao?: string;

  @ApiPropertyOptional({
    description: 'Se true, encerra também matrículas ativas do aluno. Default: true.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  encerrarMatriculasAtivas?: boolean;

  @ApiPropertyOptional({
    enum: STATUS_INATIVACAO_MATRICULA,
    description: 'Status final das matrículas ativas encerradas pela inativação.',
    example: MatriculaStatus.EVADIDA,
  })
  @IsOptional()
  @IsIn(STATUS_INATIVACAO_MATRICULA)
  statusMatricula?: StatusInativacaoMatricula;

  @ApiPropertyOptional({
    enum: MotivoEncerramentoMatricula,
    description: 'Motivo estruturado para encerrar as matrículas ativas.',
    example: MotivoEncerramentoMatricula.DESISTENCIA_VOLUNTARIA,
  })
  @IsOptional()
  @IsEnum(MotivoEncerramentoMatricula)
  motivoEncerramentoMatricula?: MotivoEncerramentoMatricula;
}
