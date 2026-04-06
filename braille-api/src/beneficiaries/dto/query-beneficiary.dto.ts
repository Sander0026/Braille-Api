import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max, IsEnum, IsDateString, IsBoolean, MaxLength } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { TipoDeficiencia, CausaDeficiencia, PreferenciaAcessibilidade, CorRaca } from '@prisma/client';

export class QueryBeneficiaryDto {
  @ApiPropertyOptional({ description: 'Página atual (Padrão: 1)', default: 1 })
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Itens por página (Padrão: 10)', default: 10 })
  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Busca por nome ou matrícula (texto livre)' })
  @IsString() @IsOptional() @MaxLength(200)
  busca?: string;

  /** @deprecated use busca */
  @ApiPropertyOptional({ description: 'Filtrar por nome (legado — use busca)' })
  @IsString() @IsOptional() @MaxLength(200)
  nome?: string;

  @ApiPropertyOptional({ description: 'Filtrar por alunos inativos (lixeira)' })
  @IsOptional() @Type(() => Boolean)
  inativos?: boolean;

  @ApiPropertyOptional({ enum: TipoDeficiencia })
  @IsOptional() @IsEnum(TipoDeficiencia)
  tipoDeficiencia?: TipoDeficiencia;

  @ApiPropertyOptional({ enum: CausaDeficiencia })
  @IsOptional() @IsEnum(CausaDeficiencia)
  causaDeficiencia?: CausaDeficiencia;

  @ApiPropertyOptional({ enum: PreferenciaAcessibilidade })
  @IsOptional() @IsEnum(PreferenciaAcessibilidade)
  prefAcessibilidade?: PreferenciaAcessibilidade;

  @ApiPropertyOptional({ description: 'Filtrar por alunos que precisam de acompanhante' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : undefined)
  @IsBoolean()
  precisaAcompanhante?: boolean;

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(60)  genero?: string;
  @ApiPropertyOptional({ enum: CorRaca }) @IsOptional() @IsEnum(CorRaca) corRaca?: CorRaca;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(60)  estadoCivil?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(100) cidade?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(2)   uf?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(150) escolaridade?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(100) rendaFamiliar?: string;

  @ApiPropertyOptional({ description: 'Data de cadastro inicial (ISO 8601)' })
  @IsOptional() @IsDateString()
  dataCadastroInicio?: string;

  @ApiPropertyOptional({ description: 'Data de cadastro final (ISO 8601)' })
  @IsOptional() @IsDateString()
  dataCadastroFim?: string;
}