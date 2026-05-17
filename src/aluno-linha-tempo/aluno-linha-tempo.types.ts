export type TipoEventoLinhaTempoAluno =
  | 'CADASTRO'
  | 'ATUALIZACAO_CADASTRO'
  | 'MATRICULA_TURMA'
  | 'ENCERRAMENTO_MATRICULA'
  | 'FREQUENCIA_PRESENTE'
  | 'FREQUENCIA_FALTA'
  | 'FREQUENCIA_FALTA_JUSTIFICADA'
  | 'ATENDIMENTO_INDIVIDUAL'
  | 'FALTA_ATENDIMENTO'
  | 'ATESTADO'
  | 'LAUDO'
  | 'CERTIFICADO'
  | 'PDI_CRIADO'
  | 'PDI_META_ATUALIZADA'
  | 'PDI_EVOLUCAO'
  | 'ACAO_RISCO_EVASAO'
  | 'INATIVACAO'
  | 'REATIVACAO';

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
