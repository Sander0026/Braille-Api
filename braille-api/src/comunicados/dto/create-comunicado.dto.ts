import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';

export class CreateComunicadoDto {
  @ApiProperty({ example: 'Festa de Fim de Ano' })
  @IsString()
  @IsNotEmpty({ message: 'O título é obrigatório' })
  titulo: string;

  @ApiProperty({ example: 'Nossa festa será no dia 20...' })
  @IsString()
  @IsNotEmpty({ message: 'O conteúdo não pode ser vazio' })
  conteudo: string;

  @ApiProperty({ example: true, required: false, description: 'Fixar no topo?' })
  @IsOptional()
  @IsBoolean()
  fixado?: boolean;
}