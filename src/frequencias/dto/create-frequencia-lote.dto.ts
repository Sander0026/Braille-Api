import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatusFrequencia } from '@prisma/client';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsDateString,
  IsUUID,
  IsArray,
  ValidateNested,
  IsEnum,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FrequenciaAlunoBadgeDto {
  @ApiProperty({ description: 'ID do Aluno' })
  @IsUUID()
  alunoId: string;

  @ApiPropertyOptional({
    enum: StatusFrequencia,
    description: 'Status oficial da frequência. Campo preferencial; substitui o legado presente.',
  })
  @IsEnum(StatusFrequencia)
  @IsOptional()
  status?: StatusFrequencia;

  @ApiPropertyOptional({
    description: 'LEGACY: status booleano de presença. Mantido temporariamente para compatibilidade.',
    deprecated: true,
  })
  @ValidateIf((dto: FrequenciaAlunoBadgeDto) => dto.status === undefined)
  @IsBoolean()
  presente?: boolean;

  @ApiPropertyOptional({ description: 'ID da Chamada Prévida Existente (Upsert)' })
  @IsUUID()
  @IsOptional()
  frequenciaId?: string;
}

export class CreateFrequenciaLoteDto {
  @ApiProperty({ description: 'Data da aula no formato ISO (YYYY-MM-DD)' })
  @IsDateString()
  dataAula: string;

  @ApiProperty({ description: 'ID da Turma/Oficina' })
  @IsUUID()
  turmaId: string;

  @ApiProperty({ description: 'Vetor contendo IDs dos alunos e status de presença individuais' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FrequenciaAlunoBadgeDto)
  alunos: FrequenciaAlunoBadgeDto[];
}
