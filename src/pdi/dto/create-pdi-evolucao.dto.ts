import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePdiEvolucaoDto {
  @ApiProperty()
  @IsString()
  @MaxLength(3000)
  descricao: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  dificuldades?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  avancos?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  proximosPassos?: string;

  @ApiPropertyOptional({ example: '2026-05-17' })
  @IsOptional()
  @IsDateString()
  dataRegistro?: string;
}
