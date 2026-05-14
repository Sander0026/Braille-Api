import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class ArquivarArquivoAtendimentoDto {
  @ApiPropertyOptional({
    description: 'Motivo administrativo da remocao logica do anexo.',
    example: 'Arquivo enviado em duplicidade.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => typeof value === 'string' ? value.trim().replace(/\0/g, '') : value)
  motivoExclusao?: string;
}
