import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

/**
 * DTO de parâmetros de consulta para listagem de mensagens de contato.
 *
 * Segurança:
 * - @Max(100): impede que um cliente autenticado requisite centenas de milhares
 *   de registros em um único request (vetor de DoS autenticado).
 * - Transform de `lida`: suporta string 'true'/'false' (query param HTTP)
 *   e boolean nativo (uso programático/testes) — elimina o bug de `true === 'true'`.
 */
export class QueryContatoDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filtrar por lida (true/false)' })
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @IsOptional()
  lida?: boolean;
}
