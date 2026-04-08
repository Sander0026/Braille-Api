import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max, IsBoolean, IsUUID, IsEnum } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { TurmaStatus } from '@prisma/client';

export class QueryTurmaDto {
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

  @ApiPropertyOptional({ description: 'Filtrar por nome da turma' })
  @IsString()
  @IsOptional()
  nome?: string;

  @ApiPropertyOptional({ description: 'Filtrar por status ativo (true=ativas, false=arquivadas, all=ambas)' })
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value === 'all' ? 'all' : undefined))
  @IsOptional()
  statusAtivo?: boolean | 'all';

  @ApiPropertyOptional({ description: 'Incluir turmas excluídas (ocultas). Default: false. Use "all" para ambos.' })
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value === 'all' ? 'all' : undefined))
  @IsOptional()
  excluido?: boolean | 'all';

  @ApiPropertyOptional({ description: 'Filtrar as turmas pelo professor responsável' })
  @IsUUID()
  @IsOptional()
  professorId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar as turmas pelo ciclo de vida (PREVISTA, ANDAMENTO, CONCLUIDA, CANCELADA)',
  })
  @IsEnum(TurmaStatus)
  @IsOptional()
  status?: TurmaStatus;
}
