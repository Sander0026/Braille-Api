import { ApiPropertyOptional } from '@nestjs/swagger';
import { AreaPdi, StatusMetaPdi } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePdiMetaDto {
  @ApiPropertyOptional({ enum: AreaPdi })
  @IsOptional()
  @IsEnum(AreaPdi)
  area?: AreaPdi;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1200)
  descricao?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1200)
  estrategia?: string;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsOptional()
  @IsDateString()
  prazo?: string;

  @ApiPropertyOptional({ enum: StatusMetaPdi })
  @IsOptional()
  @IsEnum(StatusMetaPdi)
  status?: StatusMetaPdi;
}
