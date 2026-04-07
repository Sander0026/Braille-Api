import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO de criação de mensagem de contato (rota pública — sem autenticação).
 *
 * Segurança:
 * - @MaxLength: bloqueia payloads de DoS nesta rota sem autenticação.
 * - @Transform(trim): remove espaços acidentais/maliciosos no início/fim.
 * - @Matches: valida formato de telefone sem aceitar strings arbitrárias.
 */
export class CreateContatoDto {
  @ApiProperty({ example: 'João Silva', maxLength: 120 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  nome: string;

  @ApiPropertyOptional({ example: 'joao@email.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    example: '(11) 99999-9999',
    description: 'Telefone no formato (XX) XXXXX-XXXX ou similar',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^[\d\s()+-]{7,20}$/, {
    message: 'telefone deve conter apenas dígitos, espaços e os caracteres ( ) + -',
  })
  @IsOptional()
  telefone?: string;

  @ApiProperty({ example: 'Dúvida sobre matrículas', maxLength: 200 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  assunto: string;

  @ApiProperty({ example: 'Gostaria de saber...', maxLength: 5000 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(5000)
  mensagem: string;
}