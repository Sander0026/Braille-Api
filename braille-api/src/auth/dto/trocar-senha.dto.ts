import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsStrongPassword, MaxLength } from 'class-validator';

export class TrocarSenhaDto {
  @ApiProperty({ description: 'Senha atual do usuário' })
  @IsString()
  @IsNotEmpty({ message: 'A senha atual é obrigatória.' })
  @MaxLength(72, { message: 'A senha deve ter no máximo 72 caracteres.' })
  senhaAtual: string;

  @ApiProperty({ description: 'Nova senha forte' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(72, { message: 'A nova senha deve ter no máximo 72 caracteres.' })
  @IsStrongPassword({
    minLength:    8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers:   1,
    minSymbols:   1,
  }, {
    message: 'A nova senha deve ter pelo menos 8 caracteres, com maiúsculas, minúsculas, números e símbolos.',
  })
  novaSenha: string;
}