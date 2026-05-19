import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NivelRiscoEvasao, TipoAcaoRiscoEvasao } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAcaoRiscoEvasaoDto {
  @ApiProperty()
  @IsUUID()
  alunoId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  turmaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  responsavelId?: string;

  @ApiProperty({ enum: NivelRiscoEvasao })
  @IsEnum(NivelRiscoEvasao)
  nivel: NivelRiscoEvasao;

  @ApiProperty({ enum: TipoAcaoRiscoEvasao })
  @IsEnum(TipoAcaoRiscoEvasao)
  tipoAcao: TipoAcaoRiscoEvasao;

  @ApiProperty()
  @IsString()
  @MaxLength(300)
  motivoRisco: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descricao?: string;

  @ApiPropertyOptional({ example: '2026-05-20' })
  @IsOptional()
  @IsDateString()
  prazo?: string;
}
