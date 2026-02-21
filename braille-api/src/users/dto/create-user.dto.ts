import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Maria da Silva' })
  @IsString()
  @IsNotEmpty({ message: 'O nome é obrigatório' })
  nome: string;

  @ApiProperty({ example: 'maria@brailli.com' })
  @IsEmail({}, { message: 'Formato de e-mail inválido' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório' })
  email: string;

  @ApiProperty({ example: 'senha123' })
  @IsString()
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres' })
  senha: string;

  @ApiProperty({ example: 'SECRETARIA', description: 'ADMIN, SECRETARIA ou PROFESSOR' })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiProperty({ required: false, description: 'URL da foto de perfil do usuário' })
  @IsString()
  @IsOptional()
  fotoPerfil?: string;
}