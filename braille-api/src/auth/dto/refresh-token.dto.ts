import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token opaco armazenado pelo cliente.',
  })
  @IsString()
  @IsNotEmpty({ message: 'Nenhum refresh token detectado.' })
  @MaxLength(300, { message: 'Refresh token inválido.' })
  refreshToken: string;
}
