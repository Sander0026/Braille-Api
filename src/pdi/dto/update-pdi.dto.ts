import { ApiPropertyOptional } from '@nestjs/swagger';
import { StatusPdi } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdatePdiDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  professorResponsavelId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  titulo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  objetivoGeral?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  diagnosticoInicial?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  necessidadesAcessibilidade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  recursosUtilizados?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  observacoesGerais?: string;

  @ApiPropertyOptional({ example: '2026-05-17' })
  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @ApiPropertyOptional({ example: '2026-12-10' })
  @IsOptional()
  @IsDateString()
  dataFimPrevista?: string;

  @ApiPropertyOptional({ example: '2026-12-10' })
  @IsOptional()
  @IsDateString()
  dataConclusao?: string;

  @ApiPropertyOptional({ enum: StatusPdi })
  @IsOptional()
  @IsEnum(StatusPdi)
  status?: StatusPdi;
}
