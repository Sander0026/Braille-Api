import { Injectable } from '@nestjs/common';
import { CategoriaArquivoAtendimentoIndividual, TipoRegistroAtendimentoIndividual } from '@prisma/client';

const ARQUIVO_ATENDIMENTO_PUBLIC_BASE = '/api/atendimentos-individuais/arquivos';

@Injectable()
export class AtendimentosIndividuaisSanitizerService {
  sanitizarAcompanhamento<T extends Record<string, any>>(acompanhamento: T): T {
    if (!Array.isArray(acompanhamento.atendimentos)) return acompanhamento;

    return {
      ...acompanhamento,
      atendimentos: acompanhamento.atendimentos.map((item: Record<string, any>) => this.sanitizarAtendimento(item)),
    };
  }

  sanitizarAtendimento<T extends Record<string, any>>(atendimento: T): T {
    if (!Array.isArray(atendimento.arquivos)) {
      if (atendimento.tipoRegistro !== TipoRegistroAtendimentoIndividual.FALTA_JUSTIFICADA) return atendimento;
      return {
        ...atendimento,
        temComprovante: false,
      };
    }

    const arquivos = atendimento.arquivos.map((arquivo: Record<string, any>) => this.sanitizarArquivo(arquivo));
    const temComprovante = atendimento.tipoRegistro === TipoRegistroAtendimentoIndividual.FALTA_JUSTIFICADA
      ? atendimento.arquivos.some((arquivo: Record<string, any>) => arquivo.categoria === CategoriaArquivoAtendimentoIndividual.ATESTADO)
      : undefined;

    return {
      ...atendimento,
      arquivos,
      ...(atendimento.tipoRegistro === TipoRegistroAtendimentoIndividual.FALTA_JUSTIFICADA && { temComprovante }),
    };
  }

  sanitizarArquivo<T extends Record<string, any>>(arquivo: T): Omit<T, 'urlArquivo'> & { downloadUrl: string } {
    const { urlArquivo: _urlArquivo, ...rest } = arquivo;
    return {
      ...rest,
      downloadUrl: `${ARQUIVO_ATENDIMENTO_PUBLIC_BASE}/${arquivo.id}/download`,
    };
  }
}
