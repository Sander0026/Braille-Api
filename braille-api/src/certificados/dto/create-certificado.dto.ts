import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { TipoCertificado } from '@prisma/client';

export class CreateCertificadoDto {
  @ApiProperty({ description: 'Nome descritivo do Modelo de Certificado', example: 'Diploma de Cerâmica (Frente)' })
  @IsString()
  @IsNotEmpty()
  nome: string;

  @ApiProperty({ description: 'Corpo do certificado em HTML ou texto contendo as variáveis padrão', example: 'Certificamos que {{ALUNO}} completou a oficina.' })
  @IsString()
  @IsNotEmpty()
  textoTemplate: string;

  @ApiProperty({ description: 'Nome completo do assinante principal', example: 'Lurdinha Bragança' })
  @IsString()
  @IsNotEmpty()
  nomeAssinante: string;

  @ApiProperty({ description: 'Cargo do assinante exibido logo abaixo da imagem', example: 'Presidente - ILB' })
  @IsString()
  @IsNotEmpty()
  cargoAssinante: string;

  @ApiProperty({ description: 'Nome completo do segundo assinante (opcional)', required: false })
  @IsOptional()
  @IsString()
  nomeAssinante2?: string;

  @ApiProperty({ description: 'Cargo do segundo assinante (opcional)', required: false })
  @IsOptional()
  @IsString()
  cargoAssinante2?: string;

  @ApiProperty({ description: 'Configuração do posicionamento visual drag and drop (X, Y, font)', required: false })
  @IsOptional()
  @IsString()
  layoutConfig?: string;

  @ApiProperty({ enum: TipoCertificado, default: TipoCertificado.ACADEMICO, description: 'Natureza da entrega do documento' })
  @IsEnum(TipoCertificado)
  tipo: TipoCertificado;
}
