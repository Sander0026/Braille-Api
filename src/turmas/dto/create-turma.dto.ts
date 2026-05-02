import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DiaSemana, TurmaStatus } from '@prisma/client';

/** Um turno semanal da turma. horaInicio/horaFim em MINUTOS desde meia-noite.
 *  Ex: Segunda 14h00–16h00 → { dia: 'SEG', horaInicio: 840, horaFim: 960 }
 */
export class GradeHorariaDto {
  @ApiProperty({ enum: DiaSemana, example: 'SEG' })
  @IsEnum(DiaSemana)
  dia: DiaSemana;

  @ApiProperty({ description: 'Hora de início em minutos desde meia-noite (ex: 840 = 14h00)', example: 840 })
  @IsInt()
  @Min(0)
  @Max(1439)
  horaInicio: number;

  @ApiProperty({ description: 'Hora de fim em minutos desde meia-noite (ex: 960 = 16h00)', example: 960 })
  @IsInt()
  @Min(1)
  @Max(1440)
  horaFim: number;
}

export class CreateTurmaDto {
  @ApiProperty({ example: 'Braille Básico - Turma A' })
  @IsString()
  @IsNotEmpty({ message: 'O nome da turma é obrigatório' })
  nome: string;

  @ApiPropertyOptional({ example: 'Oficina introdutória' })
  @IsString()
  @IsOptional()
  descricao?: string;

  @ApiPropertyOptional({
    description: 'Texto legado de horário (mantido por compatibilidade). Prefira usar gradeHoraria.',
    example: 'Seg e Qua, 14h às 16h',
  })
  @IsString()
  @IsOptional()
  horario?: string;

  @ApiPropertyOptional({ description: 'Capacidade máxima de alunos' })
  @IsInt()
  @IsOptional()
  @Min(1)
  capacidadeMaxima?: number;

  @ApiProperty({ example: 'uuid-do-professor-aqui', description: 'ID do professor responsável' })
  @IsUUID(4, { message: 'O ID do professor deve ser um UUID válido' })
  @IsNotEmpty()
  professorId: string;

  @ApiPropertyOptional({
    type: [GradeHorariaDto],
    description: 'Grade de horários estruturada (dia + horaInicio/horaFim em minutos)',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GradeHorariaDto)
  @IsOptional()
  gradeHoraria?: GradeHorariaDto[];

  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @IsOptional()
  @IsEnum(TurmaStatus)
  status?: TurmaStatus;

  @ApiPropertyOptional({ description: 'Carga horária total (ex: 40h)' })
  @IsString()
  @IsOptional()
  cargaHoraria?: string;

  @ApiPropertyOptional({ description: 'ID do modelo de certificado vinculado' })
  @IsUUID(4)
  @IsOptional()
  modeloCertificadoId?: string;
}
