import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, IsEnum, IsDateString, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { TipoDeficiencia, CausaDeficiencia, PreferenciaAcessibilidade } from '@prisma/client';

export class QueryBeneficiaryDto {
  @ApiPropertyOptional({ description: 'Página atual (Padrão: 1)', default: 1 })
  @Type(() => Number)
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

  @ApiPropertyOptional({ description: 'Filtrar por alunos inativos (lixeira)' })
  @IsOptional()
  @Type(() => Boolean)
  inativos?: boolean;

  // ── Filtros de Deficiência ──────────────────────────────────────
  @ApiPropertyOptional({ enum: TipoDeficiencia })
  @IsOptional()
  @IsEnum(TipoDeficiencia)
  tipoDeficiencia?: TipoDeficiencia;

  @ApiPropertyOptional({ enum: CausaDeficiencia })
  @IsOptional()
  @IsEnum(CausaDeficiencia)
  causaDeficiencia?: CausaDeficiencia;

  @ApiPropertyOptional({ enum: PreferenciaAcessibilidade })
  @IsOptional()
  @IsEnum(PreferenciaAcessibilidade)
  prefAcessibilidade?: PreferenciaAcessibilidade;

  @ApiPropertyOptional({ description: 'Filtrar por alunos que precisam de acompanhante' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : undefined)
  @IsBoolean()
  precisaAcompanhante?: boolean;

  // ── Filtros de Dados Pessoais ───────────────────────────────────
  @ApiPropertyOptional({ description: 'Filtrar por gênero' })
  @IsString()
  @IsOptional()
  genero?: string;

  @ApiPropertyOptional({ description: 'Filtrar por estado civil' })
  @IsString()
  @IsOptional()
  estadoCivil?: string;

  // ── Filtros de Localização ──────────────────────────────────────
  @ApiPropertyOptional({ description: 'Filtrar por cidade' })
  @IsString()
  @IsOptional()
  cidade?: string;

  @ApiPropertyOptional({ description: 'Filtrar por estado (UF)' })
  @IsString()
  @IsOptional()
  uf?: string;

  // ── Filtros Socioeconômicos ─────────────────────────────────────
  @ApiPropertyOptional({ description: 'Filtrar por escolaridade' })
  @IsString()
  @IsOptional()
  escolaridade?: string;

  @ApiPropertyOptional({ description: 'Filtrar por faixa de renda familiar' })
  @IsString()
  @IsOptional()
  rendaFamiliar?: string;

  // ── Filtro por Data de Cadastro ─────────────────────────────────
  @ApiPropertyOptional({ description: 'Data de cadastro inicial (ISO 8601, ex: 2025-01-01)' })
  @IsOptional()
  @IsDateString()
  dataCadastroInicio?: string;

  @ApiPropertyOptional({ description: 'Data de cadastro final (ISO 8601, ex: 2025-12-31)' })
  @IsOptional()
  @IsDateString()
  dataCadastroFim?: string;
}