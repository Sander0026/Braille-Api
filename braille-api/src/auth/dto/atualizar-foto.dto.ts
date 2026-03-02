import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl, IsNotEmpty } from 'class-validator';

export class AtualizarFotoDto {
    @ApiProperty({ description: 'URL pública da nova foto de perfil (retornada pelo endpoint de upload)' })
    @IsString()
    @IsNotEmpty()
    fotoPerfil: string;
}
