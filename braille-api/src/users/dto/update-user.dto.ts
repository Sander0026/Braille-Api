import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsStrongPassword } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
    // Senha pode ser atualizada pelo próprio usuário ou reset pelo Admin
    @ApiPropertyOptional({ description: 'Nova senha (mínimo 8 caracteres, maiúscula, número, símbolo)' })
    @IsString()
    @IsOptional()
    @IsStrongPassword(
        { minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 1 },
        { message: 'A senha deve ter pelo menos 8 caracteres, contendo letras maiúsculas, minúsculas, números e caracteres especiais.' }
    )
    senha?: string;

    @ApiPropertyOptional({ description: 'URL da foto de perfil' })
    @IsString()
    @IsOptional()
    fotoPerfil?: string;
}
