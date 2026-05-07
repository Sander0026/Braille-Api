import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { TipoCertificado } from '@prisma/client';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.replaceAll('\0', '').trim() : value;

export class CreateCertificadoDto {
  @ApiProperty({ description: 'Nome descritivo do modelo de certificado', example: 'Diploma de Ceramica' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  @Transform(trim)
  nome: string;

  @ApiProperty({
    description: 'Corpo do certificado em texto com variaveis padrao',
    example: 'Certificamos que {{ALUNO}} completou a oficina.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  @Transform(trim)
  textoTemplate: string;

  @ApiProperty({ description: 'Nome completo do assinante principal', example: 'Lurdinha Braganca' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  @Transform(trim)
  nomeAssinante: string;

  @ApiProperty({ description: 'Cargo do assinante exibido abaixo da imagem', example: 'Presidente - ILB' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  @Transform(trim)
  cargoAssinante: string;

  @ApiProperty({ description: 'Nome completo do segundo assinante (opcional)', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Transform(trim)
  nomeAssinante2?: string;

  @ApiProperty({ description: 'Cargo do segundo assinante (opcional)', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Transform(trim)
  cargoAssinante2?: string;

  @ApiProperty({
    description: 'Layout visual oficial em JSON serializado. Deve conter somente { "elements": [...] } com coordenadas percentuais.',
    example:
      '{"elements":[{"id":"nome-aluno","type":"TEXT","label":"Nome do aluno","content":"{{ALUNO}}","x":10,"y":45,"width":80,"height":8,"fontFamily":"Great Vibes","fontSize":60,"textAlign":"center","color":"#000000","zIndex":1,"visible":true}]}',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  layoutConfig?: string;

  @ApiProperty({
    enum: TipoCertificado,
    default: TipoCertificado.ACADEMICO,
    description: 'Natureza da entrega do documento',
  })
  @IsEnum(TipoCertificado)
  tipo: TipoCertificado;
}
