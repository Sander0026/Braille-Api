import { ApiPropertyOptional } from '@nestjs/swagger';
import { CategoriaArquivoAtendimentoIndividual } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class AnexarArquivoAtendimentoDto {
  @ApiPropertyOptional({ enum: CategoriaArquivoAtendimentoIndividual, default: CategoriaArquivoAtendimentoIndividual.OUTRO })
  @IsOptional()
  @IsEnum(CategoriaArquivoAtendimentoIndividual)
  categoria?: CategoriaArquivoAtendimentoIndividual = CategoriaArquivoAtendimentoIndividual.OUTRO;
}
