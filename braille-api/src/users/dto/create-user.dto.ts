import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsOptional, IsEnum, IsNotEmpty, IsStrongPassword } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ description: 'Nome completo do usuário' })
  @IsString()
  @IsNotEmpty()
  nome: string;

  @ApiProperty({ description: 'Nome de usuário para login (único)' })
  @IsString()
  @IsNotEmpty()
  username: string; 

  @ApiPropertyOptional({ description: 'E-mail do usuário' })
  @IsEmail()
  @IsOptional()
  email?: string; 

  @ApiProperty({ description: 'Senha forte de acesso' })
  @IsString()
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  }, {
    message: 'A senha deve ter pelo menos 8 caracteres, contendo letras maiúsculas, minúsculas, números e caracteres especiais (ex: !@#$%).'
  })
  senha: string;

  @ApiPropertyOptional({ enum: Role, description: 'Perfil de acesso' })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @ApiPropertyOptional({ description: 'URL da foto de perfil' })
  @IsString()
  @IsOptional()
  fotoPerfil?: string;
}