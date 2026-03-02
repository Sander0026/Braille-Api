import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsBoolean, IsOptional, IsDateString, IsUUID } from 'class-validator';

export class CreateFrequenciaDto {
  @ApiProperty({ description: 'Data da aula no formato ISO (YYYY-MM-DD)' })
  @IsDateString()
  @IsNotEmpty()
  dataAula: string;

  @ApiProperty({ description: 'Verdadeiro para Presente, Falso para Falta' })
  @IsBoolean()
  @IsNotEmpty()
  presente: boolean;

  @ApiPropertyOptional({ description: 'Justificativa da falta ou observação' })
  @IsString()
  @IsOptional()
  observacao?: string;

  @ApiProperty({ description: 'ID do aluno (Beneficiário)' })
  @IsUUID()
  @IsNotEmpty()
  alunoId: string;

  @ApiProperty({ description: 'ID da Turma/Oficina' })
  @IsUUID()
  @IsNotEmpty()
  turmaId: string;
}