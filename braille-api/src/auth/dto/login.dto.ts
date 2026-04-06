import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Transform }                        from 'class-transformer';

const sanitizeString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.replace(/\0/g, '').trim() : value;

export class LoginDto {
  @ApiProperty({ description: 'Nome de usuário para acesso', example: 'admin' })
  @IsString()
  @IsNotEmpty({ message: 'O nome de usuário é obrigatório.' })
  @MaxLength(50, { message: 'O nome de usuário deve ter no máximo 50 caracteres.' })
  @Transform(sanitizeString)
  username: string;

  @ApiProperty({ description: 'Senha de acesso', example: 'Admin123!' })
  @IsString()
  @IsNotEmpty({ message: 'A senha é obrigatória.' })
  /**
   * @MaxLength(72) — bcrypt trunca silenciosamente em 72 bytes.
   * Sem este limite, payloads de senha muito longos causam DoS (CWE-400 / bcrypt hash-bomb).
   */
  @MaxLength(72, { message: 'A senha deve ter no máximo 72 caracteres.' })
  senha: string;
}