import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'ID único do usuário (retornado no login)',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsNotEmpty({ message: 'O ID do usuário é obrigatório para rotacionar o token.' })
  @IsUUID(4, { message: 'O ID do usuário é inválido.' })
  userId: string;

  @ApiProperty({
    description: 'Refresh Token armazenado pelo cliente',
    example: '1234abcd...',
  })
  @IsString()
  @IsNotEmpty({ message: 'Nenhum Refresh Token detectado.' })
  @MaxLength(200, { message: 'Refresh Token inválido.' })
  refreshToken: string;
}
