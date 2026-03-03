import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, IsBoolean, IsUUID } from 'class-validator';
import { Type, Transform } from 'class-transformer';

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
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Filtrar por nome da turma' })
  @IsString()
  @IsOptional()
  nome?: string;

  @ApiPropertyOptional({ description: 'Filtrar por status ativo (true=ativas, false=arquivadas)' })
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : undefined)
  @IsBoolean()
  @IsOptional()
  statusAtivo?: boolean;

  @ApiPropertyOptional({ description: 'Incluir turmas excluídas (ocultas). Default: false' })
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : undefined)
  @IsBoolean()
  @IsOptional()
  excluido?: boolean;

  @ApiPropertyOptional({ description: 'Filtrar as turmas pelo professor responsável' })
  @IsUUID()
  @IsOptional()
  professorId?: string;
}
