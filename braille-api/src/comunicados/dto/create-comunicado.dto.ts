import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { CategoriaComunicado } from '@prisma/client';

export class CreateComunicadoDto {
  @ApiProperty({ description: 'Título do comunicado ou notícia', maxLength: 200 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  titulo: string;

  @ApiProperty({ description: 'Conteúdo completo (suporta HTML sanitizado)', maxLength: 50_000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50_000)
  conteudo: string;

  @ApiPropertyOptional({
    enum: CategoriaComunicado,
    description: 'Classificação para o Portal Institucional',
  })
  @IsEnum(CategoriaComunicado)
  @IsOptional()
  categoria?: CategoriaComunicado;

  @ApiPropertyOptional({ description: 'Se verdadeiro, fixa no topo do mural' })
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true'  || value === true)  return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  fixado?: boolean;

  @ApiPropertyOptional({ description: 'URL pública da imagem de capa (HTTPS obrigatório)' })
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @IsOptional()
  imagemCapa?: string;
}