import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsBoolean, IsOptional, IsDateString } from 'class-validator';

export class CreateBeneficiaryDto {
  @ApiProperty({ example: 'João da Silva' })
  @IsString()
  @IsNotEmpty({ message: 'O nome completo é obrigatório' })
  nomeCompleto: string;

  @ApiProperty({ example: '12345678901' })
  @IsString()
  @IsNotEmpty({ message: 'O CPF é obrigatório' })
  cpf: string;

  @ApiProperty({ example: '1990-05-20T00:00:00Z' })
  @IsDateString({}, { message: 'Data de nascimento inválida' })
  dataNascimento: string;

  @ApiProperty({ example: 'Maria (Mãe) - 27999999999' })
  @IsString()
  @IsNotEmpty({ message: 'Contato de emergência é vital' })
  contatoEmergencia: string;

  @ApiProperty({ example: 'Cegueira Total' })
  @IsString()
  @IsNotEmpty()
  tipoDeficiencia: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  leBraille?: boolean;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  usaCaoGuia?: boolean;

  @ApiProperty({ required: false, description: 'URL da foto de perfil' })
  @IsString()
  @IsOptional()
  fotoPerfil?: string;
}