import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { StatusInscricao } from '@prisma/client';

export class QueryInscricaoDto {
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

    @ApiPropertyOptional({
        enum: StatusInscricao,
        description: 'Filtrar por status: PENDENTE, APROVADA, RECUSADA',
    })
    @IsEnum(StatusInscricao)
    @IsOptional()
    status?: StatusInscricao;
}
