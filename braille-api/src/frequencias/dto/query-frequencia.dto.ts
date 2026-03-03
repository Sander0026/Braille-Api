import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, IsDateString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryFrequenciaDto {
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

    @ApiPropertyOptional({ description: 'Filtrar por ID da turma' })
    @IsString()
    @IsOptional()
    turmaId?: string;

    @ApiPropertyOptional({ description: 'Filtrar por ID do aluno' })
    @IsString()
    @IsOptional()
    alunoId?: string;

    @ApiPropertyOptional({ description: 'Filtrar por data (YYYY-MM-DD)' })
    @IsDateString()
    @IsOptional()
    dataAula?: string;

    @ApiPropertyOptional({ description: 'Filtrar por professor da turma' })
    @IsUUID()
    @IsOptional()
    professorId?: string;
}
