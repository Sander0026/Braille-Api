import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryUserDto {
    @ApiPropertyOptional({ default: 1 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @IsOptional()
    page?: number = 1;

    @ApiPropertyOptional({ default: 10 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    @IsOptional()
    limit?: number = 10;

    @ApiPropertyOptional({ description: 'Filtrar por nome do usuário' })
    @IsString()
    @IsOptional()
    nome?: string;

    @ApiPropertyOptional({ description: 'Listar apenas usuários inativos' })
    @Type(() => Boolean)
    @IsOptional()
    inativos?: boolean = false;
}
