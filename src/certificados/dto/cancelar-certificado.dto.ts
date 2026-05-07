import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.replaceAll('\0', '').trim() : value;

export class CancelarCertificadoDto {
  @ApiProperty({ description: 'Motivo do cancelamento do certificado' })
  @IsNotEmpty()
  @MaxLength(1000)
  @Transform(trim)
  motivo: string;
}
