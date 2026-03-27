import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class EmitirAcademicoDto {
  @ApiProperty({ description: 'ID da Turma Concluída' })
  @IsString()
  @IsNotEmpty()
  turmaId: string;

  @ApiProperty({ description: 'ID do Aluno (Matriculado na turma)' })
  @IsString()
  @IsNotEmpty()
  alunoId: string;
}
