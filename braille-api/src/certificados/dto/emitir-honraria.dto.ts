import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class EmitirHonrariaDto {
  @ApiProperty({ description: 'ID do Modelo de Certificado (Tipo HONRARIA)' })
  @IsString()
  @IsNotEmpty()
  modeloId: string;

  @ApiProperty({ description: 'Nome do parceiro/evento ou justificativa' })
  @IsString()
  @IsNotEmpty()
  nomeParceiro: string;

  @ApiProperty({ description: 'Motivo da congratulação para entrar no corpo do texto' })
  @IsString()
  @IsNotEmpty()
  motivo: string;

  @ApiProperty({ description: 'Data customizada do evento' })
  @IsString()
  @IsNotEmpty()
  dataEmissao: string;
}
