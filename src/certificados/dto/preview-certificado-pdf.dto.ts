import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.replaceAll('\0', '').trim() : value;

export class PreviewCertificadoPdfDto {
  @ApiPropertyOptional({ example: 'Maria Aparecida dos Santos Oliveira Almeida' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  @Transform(trim)
  nomeAluno?: string;

  @ApiPropertyOptional({ example: 'Curso Avancado de Braille e Tecnologias Assistivas' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  @Transform(trim)
  nomeCurso?: string;

  @ApiPropertyOptional({ example: '120 horas' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(trim)
  cargaHoraria?: string;

  @ApiPropertyOptional({ example: 'Empresa Solidaria LTDA' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  @Transform(trim)
  nomeApoiador?: string;

  @ApiPropertyOptional({ example: 'Apoio continuo a inclusao' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  @Transform(trim)
  tituloAcao?: string;

  @ApiPropertyOptional({ example: '03/01/2025' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Transform(trim)
  dataInicio?: string;

  @ApiPropertyOptional({ example: '28/03/2025' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Transform(trim)
  dataFim?: string;

  @ApiPropertyOptional({ example: '08/05/2026' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Transform(trim)
  dataEmissao?: string;

  @ApiPropertyOptional({ example: 'Apoio continuo a inclusao' })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  @Transform(trim)
  motivo?: string;
}
