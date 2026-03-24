import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class AtualizarFotoDto {
    @ApiProperty({ description: 'URL pública da nova foto de perfil ou null para remover' })
    @IsOptional()
    @IsString()
    fotoPerfil: string | null;
}
