import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class CreateTurmaDto {
  @ApiProperty({ example: 'Braille Básico - Turma A' })
  @IsString()
  @IsNotEmpty({ message: 'O nome da turma é obrigatório' })
  nome: string;

  @ApiProperty({ example: 'Oficina introdutória', required: false })
  @IsString()
  @IsOptional()
  descricao?: string;

  @ApiProperty({ example: 'Segundas e Quartas, 14h às 16h', required: false })
  @IsString()
  @IsOptional()
  horario?: string;

  @ApiProperty({ example: 'uuid-do-professor-aqui', description: 'ID do professor responsável' })
  @IsUUID(4, { message: 'O ID do professor deve ser um UUID válido' })
  @IsNotEmpty()
  professorId: string;
}