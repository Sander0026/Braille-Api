import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

const sanitizeString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.replaceAll('\0', '').trim() : value;

export class AtualizarPerfilDto {
  @ApiPropertyOptional({ description: 'Nome completo do usuário' })
  @IsString()
  @IsOptional()
  @MaxLength(150, { message: 'O nome deve ter no máximo 150 caracteres.' })
  @Transform(sanitizeString)
  nome?: string;

  @ApiPropertyOptional({ description: 'E-mail do usuário' })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @IsOptional()
  @MaxLength(254, { message: 'O e-mail deve ter no máximo 254 caracteres (RFC 5321).' })
  email?: string;
}
