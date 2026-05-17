import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export const STATUS_ALUNO_RELATORIO = ['ATIVO', 'INATIVO', 'TODOS'] as const;
export type StatusAlunoRelatorio = (typeof STATUS_ALUNO_RELATORIO)[number];

export class FiltroRelatorioGeralDto {
  @ApiPropertyOptional({ example: '2026-05-01' })
  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @ApiPropertyOptional({ example: '2026-05-31' })
  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  turmaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  professorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  alunoId?: string;

  @ApiPropertyOptional({ enum: STATUS_ALUNO_RELATORIO })
  @IsOptional()
  @IsIn(STATUS_ALUNO_RELATORIO)
  statusAluno?: StatusAlunoRelatorio;

  @ApiPropertyOptional({ description: 'Status da turma. Ex.: PREVISTA, ANDAMENTO, CONCLUIDA, CANCELADA.' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  statusTurma?: string;

  @ApiPropertyOptional({ description: 'Status da matricula. Ex.: ATIVA, CONCLUIDA, EVADIDA, CANCELADA, TRANSFERIDA.' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  statusMatricula?: string;

  @ApiPropertyOptional({ description: 'Motivo estruturado de encerramento da matricula.' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  motivoEncerramento?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  cidade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  bairro?: string;

  @ApiPropertyOptional({ description: 'Tipo de deficiencia. Ex.: CEGUEIRA_TOTAL, BAIXA_VISAO, VISAO_MONOCULAR.' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  tipoDeficiencia?: string;
}
