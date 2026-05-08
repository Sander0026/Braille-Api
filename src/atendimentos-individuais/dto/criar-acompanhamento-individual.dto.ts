import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { CriarAtendimentoIndividualDto } from './criar-atendimento-individual.dto';

const sanitizeString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.replace(/\0/g, '').trim() : value;

export class CriarAcompanhamentoIndividualDto {
  @ApiProperty({ description: 'UUID do aluno/beneficiario', example: 'uuid-do-aluno' })
  @IsUUID()
  alunoId: string;

  @ApiPropertyOptional({
    description: 'UUID do professor responsavel. Obrigatorio para ADMIN/SECRETARIA; professor usa o proprio usuario se omitido.',
  })
  @IsOptional()
  @IsUUID()
  professorId?: string;

  @ApiProperty({ example: 'Alfabetizacao em Braille' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(sanitizeString)
  assuntoAtual: string;

  @ApiPropertyOptional({ example: 'Acompanhamento individual semanal para reforco pedagogico.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(sanitizeString)
  descricao?: string;

  @ApiPropertyOptional({ type: () => CriarAtendimentoIndividualDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CriarAtendimentoIndividualDto)
  primeiroAtendimento?: CriarAtendimentoIndividualDto;
}
