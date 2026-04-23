import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class EmitirAcademicoDto {
  @ApiProperty({ description: 'ID da Turma Concluída (UUID)' })
  @IsUUID(undefined, { message: 'turmaId deve ser um UUID válido.' })
  @IsNotEmpty()
  turmaId: string;

  @ApiProperty({ description: 'ID do Aluno matriculado na turma (UUID)' })
  @IsUUID(undefined, { message: 'alunoId deve ser um UUID válido.' })
  @IsNotEmpty()
  alunoId: string;
}
