import { Injectable } from '@nestjs/common';
import {
  CategoriaArquivoAtendimentoIndividual,
  TipoRegistroAtendimentoIndividual,
  StatusAcompanhamentoIndividual,
  ModalidadeAtendimentoIndividual,
} from '@prisma/client';

const ARQUIVO_ATENDIMENTO_PUBLIC_BASE = '/api/atendimentos-individuais/arquivos';

// ─── Prisma Input Types (o que vem do banco) ────────────────────────────

/** Arquivo como retornado pelo Prisma (pode ter urlArquivo). */
interface ArquivoPrisma {
  id: string;
  atendimentoId: string;
  nomeOriginal: string;
  nomeArquivo: string;
  urlArquivo: string;
  tipoArquivo: string;
  tamanho: number;
  categoria: CategoriaArquivoAtendimentoIndividual;
  criadoPorId?: string | null;
  criadoEm: Date;
  excluidoEm?: Date | null;
  excluidoPorId?: string | null;
  motivoExclusao?: string | null;
}

/** Atendimento como retornado pelo Prisma (com campos de minutos internos). */
interface AtendimentoPrisma {
  id: string;
  acompanhamentoId: string;
  alunoId: string;
  professorId: string;
  dataAtendimento: Date;
  horaInicioMinutos?: number | null;
  horaFimMinutos?: number | null;
  duracaoMinutos?: number | null;
  modalidade?: ModalidadeAtendimentoIndividual | null;
  localAtendimento?: string | null;
  tipoRegistro: TipoRegistroAtendimentoIndividual;
  assuntoDoDia?: string | null;
  observacao?: string | null;
  evolucao?: string | null;
  dificuldades?: string | null;
  pendencias?: string | null;
  recomendacoes?: string | null;
  criadoPorId?: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
  excluidoEm?: Date | null;
  arquivos?: ArquivoPrisma[];
}

/** Acompanhamento como retornado pelo Prisma (com relações inline). */
interface AcompanhamentoPrisma {
  id: string;
  alunoId: string;
  professorId: string;
  assuntoAtual: string;
  descricao?: string | null;
  status: StatusAcompanhamentoIndividual;
  arquivado: boolean;
  arquivadoEm?: Date | null;
  arquivadoPorId?: string | null;
  desarquivadoEm?: Date | null;
  desarquivadoPorId?: string | null;
  motivoArquivamento?: string | null;
  motivoDesarquivamento?: string | null;
  dataInicio: Date;
  dataFinalizacao?: Date | null;
  resultadoFinal?: string | null;
  resumoFinal?: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
  excluidoEm?: Date | null;
  aluno?: { id: string; nomeCompleto: string; matricula?: string | null; statusAtivo?: boolean };
  professor?: { id: string; nome: string; matricula?: string | null; role?: string };
  atendimentos?: AtendimentoPrisma[];
  _count?: { atendimentos: number };
}

// ─── Response Types (o que sai para o frontend) ─────────────────────────

/** Arquivo sanitizado: sem urlArquivo, com downloadUrl. */
export interface ArquivoAtendimentoResponse {
  id: string;
  atendimentoId: string;
  nomeOriginal: string;
  nomeArquivo: string;
  tipoArquivo: string;
  tamanho: number;
  categoria: CategoriaArquivoAtendimentoIndividual;
  criadoPorId?: string | null;
  criadoEm: Date;
  excluidoEm?: Date | null;
  excluidoPorId?: string | null;
  motivoExclusao?: string | null;
  downloadUrl?: string;
}

/** Atendimento sanitizado: minutos convertidos para HH:mm. */
export interface AtendimentoIndividualResponse {
  id: string;
  acompanhamentoId: string;
  alunoId: string;
  professorId: string;
  dataAtendimento: Date;
  horaInicio?: string;
  horaFim?: string;
  duracaoMinutos?: number | null;
  modalidade?: ModalidadeAtendimentoIndividual | null;
  localAtendimento?: string | null;
  tipoRegistro: TipoRegistroAtendimentoIndividual;
  assuntoDoDia?: string | null;
  observacao?: string | null;
  evolucao?: string | null;
  dificuldades?: string | null;
  pendencias?: string | null;
  recomendacoes?: string | null;
  criadoPorId?: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
  excluidoEm?: Date | null;
  arquivos?: ArquivoAtendimentoResponse[];
  temComprovante?: boolean;
}

/** Acompanhamento sanitizado: status virtual ARQUIVADO quando arquivado=true. */
export interface AcompanhamentoIndividualResponse {
  id: string;
  alunoId: string;
  professorId: string;
  assuntoAtual: string;
  descricao?: string | null;
  status: StatusAcompanhamentoIndividual | 'ARQUIVADO';
  arquivado: boolean;
  arquivadoEm?: Date | null;
  arquivadoPorId?: string | null;
  desarquivadoEm?: Date | null;
  desarquivadoPorId?: string | null;
  motivoArquivamento?: string | null;
  motivoDesarquivamento?: string | null;
  dataInicio: Date;
  dataFinalizacao?: Date | null;
  resultadoFinal?: string | null;
  resumoFinal?: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
  excluidoEm?: Date | null;
  aluno?: { id: string; nomeCompleto: string; matricula?: string | null; statusAtivo?: boolean };
  professor?: { id: string; nome: string; matricula?: string | null; role?: string };
  atendimentos?: AtendimentoIndividualResponse[];
  _count?: { atendimentos: number };
}

// ─── Service ────────────────────────────────────────────────────────────

@Injectable()
export class AtendimentosIndividuaisSanitizerService {
  sanitizarAcompanhamento(acompanhamento: AcompanhamentoPrisma): AcompanhamentoIndividualResponse {
    const base: AcompanhamentoIndividualResponse = {
      ...acompanhamento,
      ...(acompanhamento.arquivado && { status: 'ARQUIVADO' as const }),
    };

    if (!Array.isArray(acompanhamento.atendimentos)) return base;

    return {
      ...base,
      atendimentos: acompanhamento.atendimentos.map((item) => this.sanitizarAtendimento(item)),
    };
  }

  sanitizarAtendimento(atendimento: AtendimentoPrisma): AtendimentoIndividualResponse {
    const { horaInicioMinutos, horaFimMinutos, ...rest } = atendimento;
    const base: AtendimentoIndividualResponse = {
      ...rest,
      horaInicio: this.formatarMinutos(horaInicioMinutos),
      horaFim: this.formatarMinutos(horaFimMinutos),
    };

    if (!Array.isArray(atendimento.arquivos)) {
      if (atendimento.tipoRegistro !== TipoRegistroAtendimentoIndividual.FALTA_JUSTIFICADA) return base;
      return { ...base, temComprovante: false };
    }

    const arquivos = atendimento.arquivos.map((arquivo) => this.sanitizarArquivo(arquivo));
    const temComprovante = atendimento.tipoRegistro === TipoRegistroAtendimentoIndividual.FALTA_JUSTIFICADA
      ? atendimento.arquivos.some((arquivo) => arquivo.categoria === CategoriaArquivoAtendimentoIndividual.ATESTADO && !arquivo.excluidoEm)
      : undefined;

    return {
      ...base,
      arquivos,
      ...(atendimento.tipoRegistro === TipoRegistroAtendimentoIndividual.FALTA_JUSTIFICADA && { temComprovante }),
    };
  }

  sanitizarArquivo(arquivo: ArquivoPrisma): ArquivoAtendimentoResponse {
    const { urlArquivo: _urlArquivo, ...rest } = arquivo;
    if (arquivo.excluidoEm) return rest;

    return {
      ...rest,
      downloadUrl: `${ARQUIVO_ATENDIMENTO_PUBLIC_BASE}/${arquivo.id}/download`,
    };
  }

  private formatarMinutos(value: unknown): string | undefined {
    if (!Number.isInteger(value)) return undefined;
    const total = Number(value);
    const hora = Math.floor(total / 60).toString().padStart(2, '0');
    const minuto = (total % 60).toString().padStart(2, '0');
    return `${hora}:${minuto}`;
  }
}
