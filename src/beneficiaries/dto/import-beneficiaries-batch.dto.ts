import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsObject } from 'class-validator';

export class ImportBeneficiariesBatchDto {
  @ApiProperty({
    description: 'Linhas da planilha convertidas para JSON pelo frontend.',
    type: 'array',
    maxItems: 500,
    items: {
      type: 'object',
      additionalProperties: true,
    },
  })
  @IsArray()
  @ArrayMaxSize(500)
  @IsObject({ each: true })
  data: Record<string, unknown>[];
}
