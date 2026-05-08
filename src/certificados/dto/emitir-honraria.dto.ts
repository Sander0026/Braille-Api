import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsUUID, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.replaceAll('\0', '').trim() : value;

export class EmitirHonrariaDto {
  @ApiProperty({ description: 'ID do Modelo de Certificado do tipo HONRARIA (UUID)' })
  @IsUUID('4', { message: 'modeloId deve ser um UUID valido.' })
  @IsNotEmpty()
  modeloId: string;

  @ApiProperty({ description: 'ID do apoiador cadastrado que recebera a honraria' })
  @IsUUID('4', { message: 'apoiadorId deve ser um UUID valido.' })
  @IsNotEmpty()
  apoiadorId: string;

  @ApiProperty({ description: 'Titulo/descricao da acao que motivou a honraria' })
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(trim)
  tituloAcao: string;

  @ApiPropertyOptional({ description: 'Motivo complementar para o corpo do certificado' })
  @IsOptional()
  @MaxLength(1000)
  @Transform(trim)
  motivo?: string;

  @ApiPropertyOptional({ description: 'Campo legado; o nome oficial vem do apoiador cadastrado' })
  @IsOptional()
  @MaxLength(200)
  @Transform(trim)
  nomeParceiro?: string;

  @ApiPropertyOptional({ description: 'Data do evento ou acao (ISO 8601, ex: 2024-06-15)' })
  @IsOptional()
  @IsDateString({}, { message: 'dataEvento deve estar no formato ISO 8601 (YYYY-MM-DD).' })
  dataEvento?: string;

  @ApiPropertyOptional({ description: 'Campo legado; use dataEvento em novas integracoes' })
  @IsOptional()
  @IsDateString({}, { message: 'dataEmissao deve estar no formato ISO 8601 (YYYY-MM-DD).' })
  dataEmissao?: string;
}
