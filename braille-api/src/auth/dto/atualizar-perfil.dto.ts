import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail } from 'class-validator';

export class AtualizarPerfilDto {
    @ApiProperty({ description: 'Nome completo do usuário', required: false })
    @IsString()
    @IsOptional()
    nome?: string;

    @ApiProperty({ description: 'E-mail do usuário', required: false })
    @IsEmail({}, { message: 'Informe um e-mail válido.' })
    @IsOptional()
    email?: string;
}
