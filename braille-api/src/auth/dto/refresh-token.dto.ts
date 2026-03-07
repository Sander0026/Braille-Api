import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class RefreshTokenDto {
    @ApiProperty({ description: 'ID Único do Usuário (Logado anteriormente)', example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
    @IsNotEmpty({ message: 'O ID do Usuário é obrigatório para rotacionar o token' })
    @IsUUID(4, { message: 'O ID do Usuário repassado na Sessão é inválido' })
    userId: string;

    @ApiProperty({ description: 'Visto longo armazenado silenciosamente pelo Angular localstorage', example: '1234abcd...' })
    @IsString({ message: 'O Assinatura Refresh deve ser legível' })
    @IsNotEmpty({ message: 'Nenhum Refresh Token detectado no Cliente' })
    refreshToken: string;
}
