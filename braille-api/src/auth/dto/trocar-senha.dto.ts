import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsStrongPassword } from 'class-validator';

export class TrocarSenhaDto {
  @ApiProperty({ description: 'Senha atual do usuário' })
  @IsString()
  @IsNotEmpty()
  senhaAtual: string;

  @ApiProperty({ description: 'Nova senha forte' })
  @IsString()
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  }, {
    message: 'A nova senha deve ter pelo menos 8 caracteres, contendo letras maiúsculas, minúsculas, números e símbolos.'
  })
  novaSenha: string;
}