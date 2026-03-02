import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryBeneficiaryDto {
  @ApiPropertyOptional({ description: 'Página atual (Padrão: 1)', default: 1 })
  @Type(() => Number) // Converte o texto da URL para número
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Itens por página (Padrão: 10)', default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Filtrar por nome do aluno' })
  @IsString()
  @IsOptional()
  nome?: string;

  @ApiPropertyOptional({ description: 'Filtrar por alunos inativados logicamente (Lixeira Volátil)' })
  @IsOptional()
  @Type(() => Boolean)
  inativos?: boolean;
}