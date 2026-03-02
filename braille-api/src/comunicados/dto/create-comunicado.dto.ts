import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsBoolean, IsOptional, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { CategoriaComunicado } from '@prisma/client';

export class CreateComunicadoDto {
  @ApiProperty({ description: 'Título do comunicado ou notícia' })
  @IsString()
  @IsNotEmpty()
  titulo: string;

  @ApiProperty({ description: 'Conteúdo completo' })
  @IsString()
  @IsNotEmpty()
  conteudo: string;

  // 👇 O CAMPO NOVO QUE A COORDENADORA PEDIU!
  @ApiPropertyOptional({ enum: CategoriaComunicado, description: 'Classificação para o Portal Institucional' })
  @IsEnum(CategoriaComunicado)
  @IsOptional()
  categoria?: CategoriaComunicado;

  @ApiPropertyOptional({ description: 'Se verdadeiro, fixa no topo do mural' })
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  fixado?: boolean;

  @ApiPropertyOptional({ description: 'URL da imagem de capa' })
  @IsString()
  @IsOptional()
  imagemCapa?: string;
}