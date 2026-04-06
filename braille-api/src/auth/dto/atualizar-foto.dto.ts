import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUrl, MaxLength } from 'class-validator';

export class AtualizarFotoDto {
  @ApiPropertyOptional({ description: 'URL pública da nova foto de perfil (null para remover)' })
  @IsOptional()
  /**
   * @IsUrl permissivo (require_protocol: false) — aceita URLs Cloudinary sem breaking changes.
   * @MaxLength(2000) — previne payloads excessivos.
   */
  @IsUrl({ require_protocol: false, require_tld: false }, {
    message: 'fotoPerfil deve ser uma URL válida.',
  })
  @MaxLength(2000, { message: 'URL da foto deve ter no máximo 2000 caracteres.' })
  fotoPerfil?: string | null;
}
