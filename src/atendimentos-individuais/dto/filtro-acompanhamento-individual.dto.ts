import { ApiPropertyOptional } from '@nestjs/swagger';
import { StatusAcompanhamentoIndividual } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export const STATUS_ARQUIVADO_VIRTUAL = 'ARQUIVADO' as const;
export type FiltroStatusAcompanhamentoIndividual =
  | StatusAcompanhamentoIndividual
  | typeof STATUS_ARQUIVADO_VIRTUAL;

export class FiltroAcompanhamentoIndividualDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  alunoId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  professorId?: string;

  @ApiPropertyOptional({ enum: [...Object.values(StatusAcompanhamentoIndividual), STATUS_ARQUIVADO_VIRTUAL] })
  @IsOptional()
  @IsIn([...Object.values(StatusAcompanhamentoIndividual), STATUS_ARQUIVADO_VIRTUAL])
  status?: FiltroStatusAcompanhamentoIndividual;

  @ApiPropertyOptional({ description: 'Busca por nome/matricula do aluno ou assunto.' })
  @IsOptional()
  @IsString()
  busca?: string;

  @ApiPropertyOptional({ example: '2026-05-01' })
  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @ApiPropertyOptional({ example: '2026-05-31' })
  @IsOptional()
  @IsDateString()
  dataFim?: string;
}
