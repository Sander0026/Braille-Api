import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  StatusAcompanhamentoIndividual,
  TipoRegistroAtendimentoIndividual,
} from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

export class FiltroRelatorioAtendimentoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  alunoId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  professorId?: string;

  @ApiPropertyOptional({ example: '2026-05-01' })
  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @ApiPropertyOptional({ example: '2026-05-31' })
  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @ApiPropertyOptional({ enum: StatusAcompanhamentoIndividual })
  @IsOptional()
  @IsEnum(StatusAcompanhamentoIndividual)
  status?: StatusAcompanhamentoIndividual;

  @ApiPropertyOptional({ enum: TipoRegistroAtendimentoIndividual })
  @IsOptional()
  @IsEnum(TipoRegistroAtendimentoIndividual)
  tipoRegistro?: TipoRegistroAtendimentoIndividual;
}
