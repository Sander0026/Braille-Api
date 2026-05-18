import type { TipoEventoLinhaTempoAluno } from '@prisma/client';

export type { TipoEventoLinhaTempoAluno } from '@prisma/client';

export interface LinhaTempoAlunoItem {
  id: string;
  tipo: TipoEventoLinhaTempoAluno;
  data: string;
  titulo: string;
  descricao?: string;
  origem: string;
  alunoId: string;
  turmaId?: string;
  turmaNome?: string;
  professorNome?: string;
  usuarioNome?: string;
  metadata?: Record<string, unknown>;
}

export interface LinhaTempoAlunoResumo {
  totalEventos: number;
  ultimaFrequencia?: string;
  ultimoAtendimento?: string;
  ultimoPdi?: string;
  ultimaAcaoRisco?: string;
}
