import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class CreateTurmaDto {
  @ApiProperty({ example: 'Braille Básico - Turma A' })
  @IsString()
  @IsNotEmpty({ message: 'O nome da turma é obrigatório' })
  nome: string;

  @ApiProperty({ example: 'Segundas e Quartas, 14h às 16h' })
  @IsString()
  @IsNotEmpty({ message: 'O horário é obrigatório' })
  horario: string;

  @ApiProperty({ example: 'uuid-do-professor-aqui', description: 'ID do professor responsável' })
  @IsUUID(4, { message: 'O ID do professor deve ser um UUID válido' })
  @IsNotEmpty()
  professorId: string;
}