import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatusFrequencia } from '@prisma/client';
import { IsString, IsBoolean, IsOptional, IsDateString, IsUUID, IsEnum, ValidateIf } from 'class-validator';

export class CreateFrequenciaDto {
  @ApiProperty({ description: 'Data da aula no formato ISO (YYYY-MM-DD)' })
  @IsDateString()
  dataAula: string;

  @ApiPropertyOptional({
    enum: StatusFrequencia,
    description: 'Status oficial da frequência. Campo preferencial; substitui o legado presente.',
  })
  @IsEnum(StatusFrequencia)
  @IsOptional()
  status?: StatusFrequencia;

  @ApiPropertyOptional({
    description: 'LEGACY: verdadeiro para Presente, falso para Falta. Mantido temporariamente para compatibilidade com o frontend atual.',
    deprecated: true,
  })
  @ValidateIf((dto: CreateFrequenciaDto) => dto.status === undefined)
  @IsBoolean()
  presente?: boolean;

  @ApiPropertyOptional({ description: 'Justificativa da falta ou observação' })
  @IsString()
  @IsOptional()
  observacao?: string;

  @ApiProperty({ description: 'ID do aluno (Beneficiário)' })
  @IsUUID()
  alunoId: string;

  @ApiProperty({ description: 'ID da Turma/Oficina' })
  @IsUUID()
  turmaId: string;
}
