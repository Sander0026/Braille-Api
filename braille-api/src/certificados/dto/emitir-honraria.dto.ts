import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, MaxLength, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.replaceAll('\0', '').trim() : value;

export class EmitirHonrariaDto {
  @ApiProperty({ description: 'ID do Modelo de Certificado do tipo HONRARIA (UUID)' })
  @IsUUID('4', { message: 'modeloId deve ser um UUID válido.' }) @IsNotEmpty()
  modeloId: string;

  @ApiProperty({ description: 'Nome do parceiro, evento ou pessoa homenageada' })
  @IsNotEmpty() @MaxLength(200) @Transform(trim)
  nomeParceiro: string;

  @ApiProperty({ description: 'Motivo da congratulação para o corpo do certificado' })
  @IsNotEmpty() @MaxLength(1000) @Transform(trim)
  motivo: string;

  @ApiProperty({ description: 'Data do evento ou emissão (ISO 8601, ex: 2024-06-15)' })
  @IsDateString({}, { message: 'dataEmissao deve estar no formato ISO 8601 (YYYY-MM-DD).' })
  @IsNotEmpty()
  dataEmissao: string;
}
