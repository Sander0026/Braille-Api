import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: 'Nome de usuário para acesso', example: 'admin' })
  @IsNotEmpty({ message: 'O nome de usuário é obrigatório' })
  username: string;

  @ApiProperty({ description: 'Senha de acesso', example: 'Admin123!' })
  @IsNotEmpty({ message: 'A senha é obrigatória' })
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres' })
  senha: string;
}