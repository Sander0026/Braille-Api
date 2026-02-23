import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsOptional, IsEnum, IsNotEmpty } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ description: 'Nome completo do usuário' })
  @IsString()
  @IsNotEmpty()
  nome: string;

  // 👇 O novo campo obrigatório
  @ApiProperty({ description: 'Nome de usuário para login (único)' })
  @IsString()
  @IsNotEmpty()
  username: string; 

  // 👇 O email agora é opcional
  @ApiPropertyOptional({ description: 'E-mail do usuário' })
  @IsEmail()
  @IsOptional()
  email?: string; 

  @ApiProperty({ description: 'Senha de acesso' })
  @IsString()
  @MinLength(6)
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