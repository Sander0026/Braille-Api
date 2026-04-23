import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  IsDateString,
  IsUUID,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FrequenciaAlunoBadgeDto {
  @ApiProperty({ description: 'ID do Aluno' })
  @IsUUID()
  @IsNotEmpty()
  alunoId: string;

  @ApiProperty({ description: 'Status de Presença (true/false)' })
  @IsBoolean()
  @IsNotEmpty()
  presente: boolean;

  @ApiPropertyOptional({ description: 'ID da Chamada Prévida Existente (Upsert)' })
  @IsUUID()
  @IsOptional()
  frequenciaId?: string;
}

export class CreateFrequenciaLoteDto {
  @ApiProperty({ description: 'Data da aula no formato ISO (YYYY-MM-DD)' })
  @IsDateString()
  @IsNotEmpty()
  dataAula: string;

  @ApiProperty({ description: 'ID da Turma/Oficina' })
  @IsUUID()
  @IsNotEmpty()
  turmaId: string;

  @ApiProperty({ description: 'Vetor contendo IDs dos alunos e status de presença individuais' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FrequenciaAlunoBadgeDto)
  alunos: FrequenciaAlunoBadgeDto[];
}
