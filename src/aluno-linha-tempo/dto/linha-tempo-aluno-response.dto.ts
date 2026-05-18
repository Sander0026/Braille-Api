import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrigemEventoLinhaTempo, TipoEventoLinhaTempoAluno } from '@prisma/client';

export class LinhaTempoAlunoItemDto {
  @ApiProperty({ example: '2d5c2fa7-5d16-4a44-9e6f-a8c6a90c0f55' })
  id: string;

  @ApiProperty({ enum: TipoEventoLinhaTempoAluno, example: TipoEventoLinhaTempoAluno.ATENDIMENTO_INDIVIDUAL })
  tipo: TipoEventoLinhaTempoAluno;

  @ApiProperty({ example: '2026-05-18T11:00:00.000Z' })
  data: string;

  @ApiProperty({ example: 'Atendimento individual realizado' })
  titulo: string;

  @ApiPropertyOptional({ example: 'Orientacao registrada pela equipe pedagogica.' })
  descricao?: string;

  @ApiProperty({ enum: OrigemEventoLinhaTempo, example: OrigemEventoLinhaTempo.ATENDIMENTO_INDIVIDUAL })
  origem: OrigemEventoLinhaTempo;

  @ApiProperty({ example: '8c3dff53-b36c-4d94-8709-7b779f72c640' })
  alunoId: string;

  @ApiPropertyOptional({ example: 'b1b8f972-d17a-43c7-8d52-01a2efc6ab04' })
  turmaId?: string;

  @ApiPropertyOptional({ example: 'Oficina de Braille' })
  turmaNome?: string;

  @ApiPropertyOptional({ example: 'Maria Silva' })
  professorNome?: string;

  @ApiPropertyOptional({ example: 'Secretaria' })
  usuarioNome?: string;

  @ApiPropertyOptional({
    example: { sensivel: true, restrito: true },
    description: 'Metadados sanitizados. Eventos sensiveis podem retornar apenas flags para professor.',
  })
  metadata?: Record<string, unknown>;
}

class LinhaTempoAlunoMetaDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 30 })
  limit: number;

  @ApiProperty({ example: 84 })
  total: number;

  @ApiProperty({ example: 3 })
  lastPage: number;
}

export class LinhaTempoAlunoResponseDto {
  @ApiProperty({ type: [LinhaTempoAlunoItemDto] })
  data: LinhaTempoAlunoItemDto[];

  @ApiProperty({ type: LinhaTempoAlunoMetaDto })
  meta: LinhaTempoAlunoMetaDto;
}

export class LinhaTempoAlunoResumoDto {
  @ApiProperty({ example: 84 })
  totalEventos: number;

  @ApiPropertyOptional({ example: '2026-05-18T11:00:00.000Z' })
  ultimaFrequencia?: string;

  @ApiPropertyOptional({ example: '2026-05-12T13:30:00.000Z' })
  ultimoAtendimento?: string;

  @ApiPropertyOptional({ example: '2026-05-10T09:00:00.000Z' })
  ultimoPdi?: string;

  @ApiPropertyOptional({ example: '2026-05-16T17:00:00.000Z' })
  ultimaAcaoRisco?: string;
}
