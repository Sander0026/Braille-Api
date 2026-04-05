import { AuditAcao } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsEnum, IsInt, Min, IsDateString } from 'class-validator';

export class QueryAuditDto {
    @ApiPropertyOptional({ description: 'Página atual (default: 1)', example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ description: 'Itens por página (default: 20)', example: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 20;

    @ApiPropertyOptional({ description: 'Nome da Entidade (Ex: Aluno, User)', example: 'Aluno' })
    @IsOptional()
    @IsString()
    entidade?: string;

    @ApiPropertyOptional({ description: 'ID do registro alterado', example: 'uuid-1234' })
    @IsOptional()
    @IsString()
    registroId?: string;

    @ApiPropertyOptional({ description: 'ID do autor que fez a ação', example: 'uuid-5678' })
    @IsOptional()
    @IsString()
    autorId?: string;

    @ApiPropertyOptional({ description: 'Tipo da ação', enum: AuditAcao })
    @IsOptional()
    @IsEnum(AuditAcao)
    acao?: AuditAcao;

    @ApiPropertyOptional({ description: 'Data de início (ISO)', example: '2026-03-01T00:00:00Z' })
    @IsOptional()
    @IsDateString()
    de?: string;

    @ApiPropertyOptional({ description: 'Data de fim (ISO)', example: '2026-03-31T23:59:59Z' })
    @IsOptional()
    @IsDateString()
    ate?: string;
}
