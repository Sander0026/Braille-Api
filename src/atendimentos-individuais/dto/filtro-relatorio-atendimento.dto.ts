import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ModalidadeAtendimentoIndividual,
  StatusAcompanhamentoIndividual,
  TipoRegistroAtendimentoIndividual,
} from '@prisma/client';
import { IsDateString, IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { STATUS_ARQUIVADO_VIRTUAL } from './filtro-acompanhamento-individual.dto';
import type { FiltroStatusAcompanhamentoIndividual } from './filtro-acompanhamento-individual.dto';

export class FiltroRelatorioAtendimentoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  alunoId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  professorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  atendimentoId?: string;

  @ApiPropertyOptional({ example: '2026-05-01' })
  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @ApiPropertyOptional({ example: '2026-05-31' })
  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @ApiPropertyOptional({ enum: [...Object.values(StatusAcompanhamentoIndividual), STATUS_ARQUIVADO_VIRTUAL] })
  @IsOptional()
  @IsIn([...Object.values(StatusAcompanhamentoIndividual), STATUS_ARQUIVADO_VIRTUAL])
  status?: FiltroStatusAcompanhamentoIndividual;

  @ApiPropertyOptional({ enum: TipoRegistroAtendimentoIndividual })
  @IsOptional()
  @IsEnum(TipoRegistroAtendimentoIndividual)
  tipoRegistro?: TipoRegistroAtendimentoIndividual;

  @ApiPropertyOptional({ enum: ModalidadeAtendimentoIndividual })
  @IsOptional()
  @IsEnum(ModalidadeAtendimentoIndividual)
  modalidade?: ModalidadeAtendimentoIndividual;
}
