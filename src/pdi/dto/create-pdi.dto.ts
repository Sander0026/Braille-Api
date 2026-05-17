import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreatePdiDto {
  @ApiProperty()
  @IsUUID()
  alunoId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  professorResponsavelId?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(180)
  titulo: string;

  @ApiProperty()
  @IsString()
  @MaxLength(3000)
  objetivoGeral: string;

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
}
