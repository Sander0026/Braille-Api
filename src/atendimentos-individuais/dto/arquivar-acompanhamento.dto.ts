import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ArquivarAcompanhamentoDto {
  @ApiProperty({
    description: 'Motivo do arquivamento (obrigatorio para justificativa administrativa)',
    example: 'Aluno transferido para outra instituicao.',
  })
  @IsString()
  @IsNotEmpty({ message: 'O motivo do arquivamento e obrigatorio.' })
  @MaxLength(2000, { message: 'O motivo deve ter no maximo 2000 caracteres.' })
  motivo: string;
}

export class DesarquivarAcompanhamentoDto {
  @ApiProperty({
    description: 'Motivo do desarquivamento (obrigatorio para justificativa administrativa)',
    example: 'Aluno retornou a instituicao.',
  })
  @IsString()
  @IsNotEmpty({ message: 'O motivo do desarquivamento e obrigatorio.' })
  @MaxLength(2000, { message: 'O motivo deve ter no maximo 2000 caracteres.' })
  motivo: string;
}
