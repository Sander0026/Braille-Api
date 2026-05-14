import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class VerificarDuplicidadeAcompanhamentoDto {
  @ApiProperty({ description: 'UUID do aluno acompanhado.' })
  @IsUUID()
  alunoId: string;

  @ApiPropertyOptional({ description: 'UUID do professor. Obrigatorio para ADMIN/SECRETARIA.' })
  @IsOptional()
  @IsUUID()
  professorId?: string;

  @ApiProperty({ description: 'Assunto principal do acompanhamento.', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => typeof value === 'string' ? value.trim().replace(/\0/g, '') : value)
  assuntoAtual: string;
}
