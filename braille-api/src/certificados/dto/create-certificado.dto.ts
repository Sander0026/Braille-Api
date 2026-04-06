import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { TipoCertificado } from '@prisma/client';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.replaceAll('\0', '').trim() : value;

export class CreateCertificadoDto {
  @ApiProperty({ description: 'Nome descritivo do Modelo de Certificado', example: 'Diploma de Cerâmica' })
  @IsString() @IsNotEmpty() @MaxLength(150) @Transform(trim)
  nome: string;

  @ApiProperty({ description: 'Corpo do certificado em texto com variáveis padrão', example: 'Certificamos que {{ALUNO}} completou a oficina.' })
  @IsString() @IsNotEmpty() @MaxLength(5000) @Transform(trim)
  textoTemplate: string;

  @ApiProperty({ description: 'Nome completo do assinante principal', example: 'Lurdinha Bragança' })
  @IsString() @IsNotEmpty() @MaxLength(150) @Transform(trim)
  nomeAssinante: string;

  @ApiProperty({ description: 'Cargo do assinante exibido abaixo da imagem', example: 'Presidente - ILB' })
  @IsString() @IsNotEmpty() @MaxLength(150) @Transform(trim)
  cargoAssinante: string;

  @ApiProperty({ description: 'Nome completo do segundo assinante (opcional)', required: false })
  @IsOptional() @IsString() @MaxLength(150) @Transform(trim)
  nomeAssinante2?: string;

  @ApiProperty({ description: 'Cargo do segundo assinante (opcional)', required: false })
  @IsOptional() @IsString() @MaxLength(150) @Transform(trim)
  cargoAssinante2?: string;

  @ApiProperty({ description: 'Configuração do posicionamento visual drag and drop (JSON serializado)', required: false })
  @IsOptional() @IsString() @MaxLength(10000)
  layoutConfig?: string;

  @ApiProperty({ enum: TipoCertificado, default: TipoCertificado.ACADEMICO, description: 'Natureza da entrega do documento' })
  @IsEnum(TipoCertificado)
  tipo: TipoCertificado;
}
