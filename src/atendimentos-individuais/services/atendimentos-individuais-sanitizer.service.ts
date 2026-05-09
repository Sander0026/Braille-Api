import { Injectable } from '@nestjs/common';
import { CategoriaArquivoAtendimentoIndividual, TipoRegistroAtendimentoIndividual } from '@prisma/client';

const ARQUIVO_ATENDIMENTO_PUBLIC_BASE = '/api/atendimentos-individuais/arquivos';

@Injectable()
export class AtendimentosIndividuaisSanitizerService {
  sanitizarAcompanhamento<T extends Record<string, any>>(acompanhamento: T): T {
    const base = {
      ...acompanhamento,
      ...(acompanhamento.arquivado && { status: 'ARQUIVADO' }),
    };

    if (!Array.isArray(acompanhamento.atendimentos)) return base;

    return {
      ...base,
      atendimentos: acompanhamento.atendimentos.map((item: Record<string, any>) => this.sanitizarAtendimento(item)),
    };
  }

  sanitizarAtendimento<T extends Record<string, any>>(atendimento: T): T {
    const base = this.sanitizarHorarioAtendimento(atendimento);

    if (!Array.isArray(atendimento.arquivos)) {
      if (atendimento.tipoRegistro !== TipoRegistroAtendimentoIndividual.FALTA_JUSTIFICADA) return base;
      return {
        ...base,
        temComprovante: false,
      };
    }

    const arquivos = atendimento.arquivos.map((arquivo: Record<string, any>) => this.sanitizarArquivo(arquivo));
    const temComprovante = atendimento.tipoRegistro === TipoRegistroAtendimentoIndividual.FALTA_JUSTIFICADA
      ? atendimento.arquivos.some((arquivo: Record<string, any>) => arquivo.categoria === CategoriaArquivoAtendimentoIndividual.ATESTADO)
      : undefined;

    return {
      ...base,
      arquivos,
      ...(atendimento.tipoRegistro === TipoRegistroAtendimentoIndividual.FALTA_JUSTIFICADA && { temComprovante }),
    };
  }

  sanitizarArquivo<T extends Record<string, any>>(arquivo: T): Omit<T, 'urlArquivo'> & { downloadUrl?: string } {
    const { urlArquivo: _urlArquivo, ...rest } = arquivo;
    if (arquivo.excluidoEm) return rest;

    return {
      ...rest,
      downloadUrl: `${ARQUIVO_ATENDIMENTO_PUBLIC_BASE}/${arquivo.id}/download`,
    };
  }

  private sanitizarHorarioAtendimento<T extends Record<string, any>>(atendimento: T): T {
    const { horaInicioMinutos, horaFimMinutos, ...rest } = atendimento;

    return ({
      ...rest,
      horaInicio: this.formatarMinutos(horaInicioMinutos),
      horaFim: this.formatarMinutos(horaFimMinutos),
    } as unknown) as T;
  }

  private formatarMinutos(value: unknown): string | undefined {
    if (!Number.isInteger(value)) return undefined;
    const total = Number(value);
    const hora = Math.floor(total / 60).toString().padStart(2, '0');
    const minuto = (total % 60).toString().padStart(2, '0');
    return `${hora}:${minuto}`;
  }
}
