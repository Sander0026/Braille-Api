import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class QueryContatoDto {
    @ApiPropertyOptional({ default: 1 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @IsOptional()
    page?: number = 1;

    @ApiPropertyOptional({ default: 20 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @IsOptional()
    limit?: number = 20;

    @ApiPropertyOptional({ description: 'Filtrar por lida (true/false)' })
    @Transform(({ value }) => value === 'true')
    @IsBoolean()
    @IsOptional()
    lida?: boolean;
}
