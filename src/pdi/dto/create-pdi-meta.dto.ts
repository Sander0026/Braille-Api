import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AreaPdi } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePdiMetaDto {
  @ApiProperty({ enum: AreaPdi })
  @IsEnum(AreaPdi)
  area: AreaPdi;

  @ApiProperty()
  @IsString()
  @MaxLength(1200)
  descricao: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1200)
  estrategia?: string;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsOptional()
  @IsDateString()
  prazo?: string;
}
