import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty } from 'class-validator';

export class ImportBatchDto {
  @ApiProperty({ description: 'Array de registros extraídos da planilha do Excel, onde cada objeto é uma linha com suas colunas e valores.' })
  @IsArray()
  @IsNotEmpty()
  data: Record<string, unknown>[];
}
