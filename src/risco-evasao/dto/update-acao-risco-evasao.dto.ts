import { ApiPropertyOptional } from '@nestjs/swagger';
import { StatusAcaoRiscoEvasao, TipoAcaoRiscoEvasao } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateAcaoRiscoEvasaoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  responsavelId?: string;

  @ApiPropertyOptional({ enum: TipoAcaoRiscoEvasao })
  @IsOptional()
  @IsEnum(TipoAcaoRiscoEvasao)
  tipoAcao?: TipoAcaoRiscoEvasao;

  @ApiPropertyOptional({ enum: StatusAcaoRiscoEvasao })
  @IsOptional()
  @IsEnum(StatusAcaoRiscoEvasao)
  status?: StatusAcaoRiscoEvasao;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descricao?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resultado?: string;

  @ApiPropertyOptional({ example: '2026-05-20' })
  @IsOptional()
  @IsDateString()
  prazo?: string;
}
