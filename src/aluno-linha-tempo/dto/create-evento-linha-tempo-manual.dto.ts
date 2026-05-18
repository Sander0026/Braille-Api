import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateEventoLinhaTempoManualDto {
  @ApiProperty({ enum: ['OBSERVACAO_MANUAL'] })
  @IsIn(['OBSERVACAO_MANUAL'])
  tipo: 'OBSERVACAO_MANUAL';

  @ApiPropertyOptional({ example: '2026-05-18' })
  @IsOptional()
  @IsDateString()
  dataEvento?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(180)
  titulo: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descricao?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  turmaId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  sensivel?: boolean;
}
