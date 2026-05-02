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
 * Segurança (OWASP A03 - Injection / A05 - Misconfiguration):
 * - @MaxLength: mitiga DoS por payload gigante nesta rota sem autenticação.
 * - @Transform: trim + conversão de string vazia para `undefined` — garante
 *   que `@IsOptional()` funcione corretamente com `class-validator`.
 *   ⚠️  CORREÇÃO CRÍTICA: `@IsOptional()` do class-validator ignora apenas
 *   `null` e `undefined`, NÃO strings vazias (`""`). Um campo opcional enviado
 *   como `""` ainda passa pelo `@IsEmail()` / `@Matches()` e causa 400.
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
  // Converte string vazia → undefined ANTES de @IsEmail/@IsOptional
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim().toLowerCase();
    return trimmed === '' ? undefined : trimmed;
  })
  @IsEmail({}, { message: 'email deve ter um formato válido (ex: usuario@dominio.com)' })
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    example: '(11) 99999-9999',
    description: 'Telefone no formato (XX) XXXXX-XXXX ou similar',
  })
  // Converte string vazia → undefined ANTES de @Matches/@IsOptional
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  })
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
