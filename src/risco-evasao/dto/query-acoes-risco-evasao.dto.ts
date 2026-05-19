import { ApiPropertyOptional } from '@nestjs/swagger';
import { NivelRiscoEvasao, StatusAcaoRiscoEvasao } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class QueryAcoesRiscoEvasaoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  alunoId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  turmaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  responsavelId?: string;

  @ApiPropertyOptional({ enum: NivelRiscoEvasao })
  @IsOptional()
  @IsEnum(NivelRiscoEvasao)
  nivel?: NivelRiscoEvasao;

  @ApiPropertyOptional({ enum: StatusAcaoRiscoEvasao })
  @IsOptional()
  @IsEnum(StatusAcaoRiscoEvasao)
  status?: StatusAcaoRiscoEvasao;

  @ApiPropertyOptional({ example: '2026-05-01' })
  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @ApiPropertyOptional({ example: '2026-05-31' })
  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
