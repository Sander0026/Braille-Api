import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, IsEnum, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { CategoriaComunicado } from '@prisma/client';

export class QueryComunicadoDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Filtrar por título (parcial, case-insensitive)', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  titulo?: string;

  @ApiPropertyOptional({ enum: CategoriaComunicado, description: 'Filtrar por categoria' })
  @IsEnum(CategoriaComunicado)
  @IsOptional()
  categoria?: CategoriaComunicado;
}
