import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsNotEmpty, IsOptional, IsUUID, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.replaceAll('\0', '').trim() : value;

export class EmitirManualAcademicoDto {
  @ApiProperty({ description: 'ID do modelo de certificado academico' })
  @IsUUID('4', { message: 'modeloId deve ser um UUID valido.' })
  @IsNotEmpty()
  modeloId: string;

  @ApiProperty({ description: 'ID do aluno cadastrado que recebera o certificado' })
  @IsUUID('4', { message: 'alunoId deve ser um UUID valido.' })
  @IsNotEmpty()
  alunoId: string;

  @ApiProperty({ description: 'ID da turma/curso cadastrado que sera impresso no certificado' })
  @IsUUID('4', { message: 'turmaId deve ser um UUID valido.' })
  @IsNotEmpty()
  turmaId: string;

  @ApiPropertyOptional({ description: 'Matricula informada manualmente' })
  @IsOptional()
  @MaxLength(60)
  @Transform(trim)
  matricula?: string;

  @ApiPropertyOptional({ description: 'Campo legado; o nome oficial vem do aluno cadastrado' })
  @IsOptional()
  @MaxLength(200)
  @Transform(trim)
  nomeAluno?: string;

  @ApiPropertyOptional({ description: 'Campo legado; o curso oficial vem da turma cadastrada' })
  @IsOptional()
  @MaxLength(200)
  @Transform(trim)
  nomeCurso?: string;

  @ApiPropertyOptional({ description: 'Campo legado; a carga horaria oficial vem da turma cadastrada' })
  @IsOptional()
  @MaxLength(80)
  @Transform(trim)
  cargaHoraria?: string;

  @ApiPropertyOptional({ description: 'Data de inicio do curso (ISO 8601)' })
  @IsOptional()
  @IsDateString({}, { message: 'dataInicio deve estar no formato ISO 8601.' })
  dataInicio?: string;

  @ApiPropertyOptional({ description: 'Data de fim/conclusao do curso (ISO 8601)' })
  @IsOptional()
  @IsDateString({}, { message: 'dataFim deve estar no formato ISO 8601.' })
  dataFim?: string;

  @ApiPropertyOptional({ description: 'Data de emissao do certificado (ISO 8601)' })
  @IsOptional()
  @IsDateString({}, { message: 'dataEmissao deve estar no formato ISO 8601.' })
  dataEmissao?: string;
}
