import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional, IsEnum, IsNotEmpty } from 'class-validator';
import { Role } from '@prisma/client';

/**
 * DTO de criação de Usuário de Sistema (Staff).
 *
 * O ADMIN informa apenas: Nome, CPF e Cargo.
 * O backend gera automaticamente: username, senha padrão e matrícula.
 */
export class CreateUserDto {
  @ApiProperty({ description: 'Nome completo do funcionário' })
  @IsString()
  @IsNotEmpty()
  nome: string;

  @ApiProperty({ description: 'CPF do funcionário (único, sem formatação. Ex: 12345678901)' })
  @IsString()
  @IsNotEmpty()
  cpf: string;

  @ApiPropertyOptional({ enum: Role, description: 'Perfil de acesso' })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @ApiPropertyOptional({ description: 'E-mail do funcionário' })
  @IsEmail()
  @IsOptional()
  email?: string;

  // ── Contato e Endereço (opcionais) ───────────────────────────────
  @ApiPropertyOptional() @IsString() @IsOptional() telefone?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() cep?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() rua?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() numero?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() complemento?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() bairro?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() cidade?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() uf?: string;
}