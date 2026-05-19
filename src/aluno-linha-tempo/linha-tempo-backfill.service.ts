import { Injectable } from '@nestjs/common';
import {
  AuditAcao,
  MatriculaStatus,
  Prisma,
  StatusAcaoRiscoEvasao,
  StatusFrequencia,
  StatusPdi,
  TipoRegistroAtendimentoIndividual,
  VisibilidadeEventoLinhaTempo,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventoLinhaTempoService } from './evento-linha-tempo.service';

type PrismaLike = Pick<
  PrismaService,
  | 'aluno'
  | 'matriculaOficina'
  | 'frequencia'
  | 'atendimentoIndividual'
  | 'atestado'
  | 'laudoMedico'
  | 'certificadoEmitido'
  | 'pdiAluno'
  | 'acaoRiscoEvasao'
  | 'auditLog'
>;

@Injectable()
export class LinhaTempoBackfillService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventoLinhaTempo: EventoLinhaTempoService,
  ) {}

  async backfillTodos(): Promise<{ alunos: number; eventos: number }> {
    const alunos = await this.prisma.aluno.findMany({
      where: { excluido: false },
      select: { id: true },
      orderBy: { criadoEm: 'asc' },
    });

    let eventos = 0;
    for (const aluno of alunos) {
      eventos += await this.backfillAluno(aluno.id);
    }

    return { alunos: alunos.length, eventos };
  }

  async backfillAluno(alunoId: string): Promise<number> {
    const aluno = await this.prisma.aluno.findFirst({
      where: { id: alunoId, excluido: false },
      select: {
        id: true,
        nomeCompleto: true,
        criadoEm: true,
        atualizadoEm: true,
        motivoInativacao: true,
        observacaoInativacao: true,
        inativadoEm: true,
        reativadoEm: true,
        motivoReativacao: true,
      },
    });

    if (!aluno) return 0;

    let eventos = 0;
    const registrar = async (data: Parameters<EventoLinhaTempoService['registrarEvento']>[0]) => {
      await this.eventoLinhaTempo.registrarEvento(data);
      eventos++;
    };

    await registrar({
      alunoId,
      tipo: 'CADASTRO',
      origem: 'ALUNO',
      origemId: aluno.id,
      chaveEvento: `ALUNO:${aluno.id}:CADASTRO`,
      dataEvento: aluno.criadoEm,
      titulo: 'Aluno cadastrado',
      descricao: `Cadastro de ${aluno.nomeCompleto} realizado no sistema.`,
    });

    if (aluno.inativadoEm) {
      await registrar({
        alunoId,
        tipo: 'INATIVACAO',
        origem: 'ALUNO',
        origemId: aluno.id,
        chaveEvento: `ALUNO:${aluno.id}:INATIVACAO:${aluno.inativadoEm.toISOString()}`,
        dataEvento: aluno.inativadoEm,
        titulo: 'Aluno inativado',
        descricao: `Motivo: ${aluno.motivoInativacao ?? 'Nao informado'}. ${aluno.observacaoInativacao ?? ''}`.trim(),
        metadata: { motivoInativacao: aluno.motivoInativacao },
      });
    }

    if (aluno.reativadoEm) {
      await registrar({
        alunoId,
        tipo: 'REATIVACAO',
        origem: 'ALUNO',
        origemId: aluno.id,
        chaveEvento: `ALUNO:${aluno.id}:REATIVACAO:${aluno.reativadoEm.toISOString()}`,
        dataEvento: aluno.reativadoEm,
        titulo: 'Aluno reativado',
        descricao: aluno.motivoReativacao || 'Aluno reativado na instituicao.',
      });
    }

    const auditoriasCadastro = await this.prisma.auditLog.findMany({
      where: {
        entidade: 'Aluno',
        registroId: alunoId,
        acao: AuditAcao.ATUALIZAR,
      },
      select: { id: true, acao: true, autorId: true, autorNome: true, criadoEm: true },
      orderBy: { criadoEm: 'asc' },
    });

    for (const audit of auditoriasCadastro) {
      await registrar({
        alunoId,
        usuarioId: audit.autorId ?? undefined,
        tipo: 'ATUALIZACAO_CADASTRO',
        origem: 'AUDIT_LOG',
        origemId: audit.id,
        chaveEvento: `AUDIT_LOG:${audit.id}:ALUNO_ATUALIZACAO`,
        dataEvento: audit.criadoEm,
        titulo: 'Cadastro atualizado',
        descricao: 'Dados cadastrais do aluno foram atualizados.',
        usuarioNomeSnapshot: audit.autorNome ?? undefined,
        metadata: { acao: audit.acao },
      });
    }

    await this.backfillMatriculas(alunoId, registrar);
    await this.backfillFrequencias(alunoId, registrar);
    await this.backfillAtendimentos(alunoId, registrar);
    await this.backfillAtestados(alunoId, registrar);
    await this.backfillLaudos(alunoId, registrar);
    await this.backfillCertificados(alunoId, registrar);
    await this.backfillPdis(alunoId, registrar);
    await this.backfillAcoesRisco(alunoId, registrar);

    return eventos;
  }

  private async backfillMatriculas(
    alunoId: string,
    registrar: (data: Parameters<EventoLinhaTempoService['registrarEvento']>[0]) => Promise<void>,
  ) {
    const matriculas = await this.prisma.matriculaOficina.findMany({
      where: { alunoId },
      include: {
        turma: { select: { id: true, nome: true, professor: { select: { nome: true } } } },
      },
      orderBy: { dataEntrada: 'asc' },
    });

    for (const matricula of matriculas) {
      await registrar({
        alunoId,
        turmaId: matricula.turmaId,
        tipo: 'MATRICULA_TURMA',
        origem: 'MATRICULA_OFICINA',
        origemId: matricula.id,
        chaveEvento: `MATRICULA_OFICINA:${matricula.id}:MATRICULA_TURMA`,
        dataEvento: matricula.dataEntrada,
        titulo: 'Matricula em turma',
        descricao: `Aluno matriculado na turma ${matricula.turma.nome}.`,
        turmaNomeSnapshot: matricula.turma.nome,
        professorNomeSnapshot: matricula.turma.professor?.nome,
        metadata: { status: matricula.status },
      });

      if (matricula.status !== MatriculaStatus.ATIVA && (matricula.dataEncerramento || matricula.encerradoEm)) {
        await registrar({
          alunoId,
          turmaId: matricula.turmaId,
          usuarioId: matricula.encerradoPorId ?? undefined,
          tipo: 'ENCERRAMENTO_MATRICULA',
          origem: 'MATRICULA_OFICINA',
          origemId: matricula.id,
          chaveEvento: `MATRICULA_OFICINA:${matricula.id}:ENCERRAMENTO_MATRICULA`,
          dataEvento: matricula.dataEncerramento ?? matricula.encerradoEm ?? matricula.atualizadoEm,
          titulo: `Matricula ${matricula.status.toLowerCase()}`,
          descricao: `Motivo: ${matricula.motivoEncerramento ?? 'Nao informado'}. ${matricula.observacao ?? ''}`.trim(),
          turmaNomeSnapshot: matricula.turma.nome,
          professorNomeSnapshot: matricula.turma.professor?.nome,
          metadata: {
            status: matricula.status,
            motivoEncerramento: matricula.motivoEncerramento,
          },
        });
      }
    }
  }

  private async backfillFrequencias(
    alunoId: string,
    registrar: (data: Parameters<EventoLinhaTempoService['registrarEvento']>[0]) => Promise<void>,
  ) {
    const frequencias = await this.prisma.frequencia.findMany({
      where: { alunoId },
      include: {
        turma: { select: { id: true, nome: true, professor: { select: { nome: true } } } },
      },
      orderBy: { dataAula: 'asc' },
    });

    for (const frequencia of frequencias) {
      await registrar({
        alunoId,
        turmaId: frequencia.turmaId,
        tipo: this.tipoFrequencia(frequencia.status),
        origem: 'FREQUENCIA',
        origemId: frequencia.id,
        chaveEvento: `FREQUENCIA:${frequencia.id}:STATUS`,
        dataEvento: frequencia.dataAula,
        titulo: this.tituloFrequencia(frequencia.status),
        descricao: frequencia.observacao || `Registro de chamada na turma ${frequencia.turma.nome}.`,
        turmaNomeSnapshot: frequencia.turma.nome,
        professorNomeSnapshot: frequencia.turma.professor?.nome,
        metadata: {
          status: frequencia.status,
          fechado: frequencia.fechado,
          justificadaPorAtestado: Boolean(frequencia.justificativaId),
        },
      });
    }
  }

  private async backfillAtendimentos(
    alunoId: string,
    registrar: (data: Parameters<EventoLinhaTempoService['registrarEvento']>[0]) => Promise<void>,
  ) {
    const atendimentos = await this.prisma.atendimentoIndividual.findMany({
      where: { alunoId, excluidoEm: null },
      include: {
        professor: { select: { nome: true } },
        criadoPor: { select: { id: true, nome: true } },
        acompanhamento: { select: { id: true, assuntoAtual: true } },
      },
      orderBy: { dataAtendimento: 'asc' },
    });

    for (const atendimento of atendimentos) {
      const falta = atendimento.tipoRegistro === TipoRegistroAtendimentoIndividual.FALTA_JUSTIFICADA
        || atendimento.tipoRegistro === TipoRegistroAtendimentoIndividual.FALTA_NAO_JUSTIFICADA
        || atendimento.tipoRegistro === TipoRegistroAtendimentoIndividual.CANCELADO;

      await registrar({
        alunoId,
        usuarioId: atendimento.criadoPorId ?? undefined,
        tipo: falta ? 'FALTA_ATENDIMENTO' : 'ATENDIMENTO_INDIVIDUAL',
        origem: 'ATENDIMENTO_INDIVIDUAL',
        origemId: atendimento.id,
        chaveEvento: `ATENDIMENTO_INDIVIDUAL:${atendimento.id}:REGISTRO`,
        dataEvento: atendimento.dataAtendimento,
        titulo: this.tituloAtendimento(atendimento.tipoRegistro),
        descricao: atendimento.assuntoDoDia || atendimento.evolucao || atendimento.observacao || atendimento.acompanhamento.assuntoAtual,
        professorNomeSnapshot: atendimento.professor?.nome,
        usuarioNomeSnapshot: atendimento.criadoPor?.nome,
        metadata: {
          tipoRegistro: atendimento.tipoRegistro,
          modalidade: atendimento.modalidade,
          duracaoMinutos: atendimento.duracaoMinutos,
          acompanhamentoId: atendimento.acompanhamentoId,
        },
      });
    }
  }

  private async backfillAtestados(
    alunoId: string,
    registrar: (data: Parameters<EventoLinhaTempoService['registrarEvento']>[0]) => Promise<void>,
  ) {
    const atestados = await this.prisma.atestado.findMany({
      where: { alunoId },
      include: { frequencias: { select: { id: true } } },
      orderBy: { criadoEm: 'asc' },
    });

    for (const atestado of atestados) {
      await registrar({
        alunoId,
        usuarioId: atestado.registradoPorId,
        tipo: 'ATESTADO',
        origem: 'ATESTADO',
        origemId: atestado.id,
        chaveEvento: `ATESTADO:${atestado.id}:CRIADO`,
        dataEvento: atestado.criadoEm,
        titulo: 'Atestado registrado',
        descricao: `Periodo: ${this.formatarDataCurta(atestado.dataInicio)} a ${this.formatarDataCurta(atestado.dataFim)}. Motivo: ${atestado.motivo}.`,
        metadata: {
          dataInicio: atestado.dataInicio.toISOString(),
          dataFim: atestado.dataFim.toISOString(),
          faltasJustificadas: atestado.frequencias.length,
        },
        visibilidade: VisibilidadeEventoLinhaTempo.RESTRITA,
        sensivel: true,
      });
    }
  }

  private async backfillLaudos(
    alunoId: string,
    registrar: (data: Parameters<EventoLinhaTempoService['registrarEvento']>[0]) => Promise<void>,
  ) {
    const laudos = await this.prisma.laudoMedico.findMany({
      where: { alunoId, excluidoEm: null },
      orderBy: { criadoEm: 'asc' },
    });

    for (const laudo of laudos) {
      await registrar({
        alunoId,
        usuarioId: laudo.registradoPorId ?? undefined,
        tipo: 'LAUDO',
        origem: 'LAUDO_MEDICO',
        origemId: laudo.id,
        chaveEvento: `LAUDO_MEDICO:${laudo.id}:CRIADO`,
        dataEvento: laudo.criadoEm,
        titulo: 'Laudo medico registrado',
        descricao: laudo.descricao || `Data de emissao: ${this.formatarDataCurta(laudo.dataEmissao)}.`,
        metadata: {
          dataEmissao: laudo.dataEmissao.toISOString(),
          medicoResponsavel: laudo.medicoResponsavel,
        },
        visibilidade: VisibilidadeEventoLinhaTempo.RESTRITA,
        sensivel: true,
      });
    }
  }

  private async backfillCertificados(
    alunoId: string,
    registrar: (data: Parameters<EventoLinhaTempoService['registrarEvento']>[0]) => Promise<void>,
  ) {
    const certificados = await this.prisma.certificadoEmitido.findMany({
      where: { alunoId },
      include: {
        turma: { select: { id: true, nome: true, professor: { select: { nome: true } } } },
        modelo: { select: { nome: true } },
      },
      orderBy: { dataEmissao: 'asc' },
    });

    for (const certificado of certificados) {
      await registrar({
        alunoId,
        turmaId: certificado.turmaId ?? undefined,
        tipo: 'CERTIFICADO',
        origem: 'CERTIFICADO',
        origemId: certificado.id,
        chaveEvento: `CERTIFICADO:${certificado.id}:EMITIDO`,
        dataEvento: certificado.dataEmissao,
        titulo: 'Certificado emitido',
        descricao: certificado.cursoImpresso || certificado.turma?.nome || certificado.modelo.nome,
        turmaNomeSnapshot: certificado.turma?.nome,
        professorNomeSnapshot: certificado.turma?.professor?.nome,
        metadata: {
          codigoValidacao: certificado.codigoValidacao,
          status: certificado.status,
          modelo: certificado.modelo.nome,
        },
      });
    }
  }

  private async backfillPdis(
    alunoId: string,
    registrar: (data: Parameters<EventoLinhaTempoService['registrarEvento']>[0]) => Promise<void>,
  ) {
    const pdis = await this.prisma.pdiAluno.findMany({
      where: { alunoId },
      include: {
        professorResponsavel: { select: { nome: true } },
        metas: { orderBy: { criadoEm: 'asc' } },
        evolucoes: {
          include: { registradoPor: { select: { id: true, nome: true } } },
          orderBy: { dataRegistro: 'asc' },
        },
      },
      orderBy: { criadoEm: 'asc' },
    });

    for (const pdi of pdis) {
      await registrar({
        alunoId,
        usuarioId: pdi.criadoPorId ?? undefined,
        tipo: 'PDI_CRIADO',
        origem: 'PDI',
        origemId: pdi.id,
        chaveEvento: `PDI:${pdi.id}:CRIADO`,
        dataEvento: pdi.criadoEm,
        titulo: 'PDI criado',
        descricao: pdi.objetivoGeral,
        professorNomeSnapshot: pdi.professorResponsavel?.nome,
        metadata: { status: pdi.status, titulo: pdi.titulo },
      });

      if (pdi.status === StatusPdi.CONCLUIDO && pdi.dataConclusao) {
        await registrar({
          alunoId,
          usuarioId: pdi.criadoPorId ?? undefined,
          tipo: 'PDI_EVOLUCAO',
          origem: 'PDI',
          origemId: pdi.id,
          chaveEvento: `PDI:${pdi.id}:CONCLUIDO`,
          dataEvento: pdi.dataConclusao,
          titulo: 'PDI concluido',
          descricao: pdi.objetivoGeral,
          professorNomeSnapshot: pdi.professorResponsavel?.nome,
          metadata: { status: pdi.status, titulo: pdi.titulo },
        });
      }

      for (const meta of pdi.metas) {
        await registrar({
          alunoId,
          tipo: 'PDI_META_CRIADA',
          origem: 'PDI_META',
          origemId: meta.id,
          chaveEvento: `PDI_META:${meta.id}:CRIADA`,
          dataEvento: meta.criadoEm,
          titulo: 'Meta do PDI criada',
          descricao: meta.descricao,
          professorNomeSnapshot: pdi.professorResponsavel?.nome,
          metadata: { area: meta.area, status: meta.status, pdiId: pdi.id },
        });

        if (meta.atualizadoEm.getTime() !== meta.criadoEm.getTime()) {
          await registrar({
            alunoId,
            tipo: 'PDI_META_ATUALIZADA',
            origem: 'PDI_META',
            origemId: meta.id,
            chaveEvento: `PDI_META:${meta.id}:ATUALIZADA:${meta.atualizadoEm.toISOString()}`,
            dataEvento: meta.atualizadoEm,
            titulo: 'Meta do PDI atualizada',
            descricao: meta.descricao,
            professorNomeSnapshot: pdi.professorResponsavel?.nome,
            metadata: { area: meta.area, status: meta.status, pdiId: pdi.id },
          });
        }
      }

      for (const evolucao of pdi.evolucoes) {
        await registrar({
          alunoId,
          usuarioId: evolucao.registradoPorId ?? undefined,
          tipo: 'PDI_EVOLUCAO',
          origem: 'PDI_EVOLUCAO',
          origemId: evolucao.id,
          chaveEvento: `PDI_EVOLUCAO:${evolucao.id}:CRIADA`,
          dataEvento: evolucao.dataRegistro,
          titulo: 'Evolucao registrada no PDI',
          descricao: evolucao.avancos || evolucao.descricao,
          professorNomeSnapshot: pdi.professorResponsavel?.nome,
          usuarioNomeSnapshot: evolucao.registradoPor?.nome,
          metadata: { pdiId: pdi.id },
        });
      }
    }
  }

  private async backfillAcoesRisco(
    alunoId: string,
    registrar: (data: Parameters<EventoLinhaTempoService['registrarEvento']>[0]) => Promise<void>,
  ) {
    const acoes = await this.prisma.acaoRiscoEvasao.findMany({
      where: { alunoId },
      include: {
        turma: { select: { id: true, nome: true, professor: { select: { nome: true } } } },
        responsavel: { select: { id: true, nome: true } },
      },
      orderBy: { criadoEm: 'asc' },
    });

    for (const acao of acoes) {
      await registrar({
        alunoId,
        turmaId: acao.turmaId ?? undefined,
        usuarioId: acao.criadoPorId ?? acao.responsavelId ?? undefined,
        tipo: 'ACAO_RISCO_EVASAO',
        origem: 'ACAO_RISCO_EVASAO',
        origemId: acao.id,
        chaveEvento: `ACAO_RISCO_EVASAO:${acao.id}:CRIADA`,
        dataEvento: acao.criadoEm,
        titulo: 'Acao de risco de evasao criada',
        descricao: acao.descricao || acao.motivoRisco,
        turmaNomeSnapshot: acao.turma?.nome,
        professorNomeSnapshot: acao.turma?.professor?.nome,
        usuarioNomeSnapshot: acao.responsavel?.nome,
        metadata: {
          nivel: acao.nivel,
          status: acao.status,
          tipoAcao: acao.tipoAcao,
          prazo: acao.prazo?.toISOString(),
        },
      });

      if (acao.status === StatusAcaoRiscoEvasao.RESOLVIDA && acao.resolvidoEm) {
        await registrar({
          alunoId,
          turmaId: acao.turmaId ?? undefined,
          usuarioId: acao.responsavelId ?? undefined,
          tipo: 'ACAO_RISCO_RESOLVIDA',
          origem: 'ACAO_RISCO_EVASAO',
          origemId: acao.id,
          chaveEvento: `ACAO_RISCO_EVASAO:${acao.id}:RESOLVIDA`,
          dataEvento: acao.resolvidoEm,
          titulo: 'Acao de risco de evasao resolvida',
          descricao: acao.resultado || acao.descricao || acao.motivoRisco,
          turmaNomeSnapshot: acao.turma?.nome,
          professorNomeSnapshot: acao.turma?.professor?.nome,
          usuarioNomeSnapshot: acao.responsavel?.nome,
          metadata: {
            nivel: acao.nivel,
            status: acao.status,
            tipoAcao: acao.tipoAcao,
            prazo: acao.prazo?.toISOString(),
          },
        });
      }
    }
  }

  private tipoFrequencia(status: StatusFrequencia) {
    if (status === StatusFrequencia.PRESENTE) return 'FREQUENCIA_PRESENTE';
    if (status === StatusFrequencia.FALTA_JUSTIFICADA) return 'FREQUENCIA_FALTA_JUSTIFICADA';
    return 'FREQUENCIA_FALTA';
  }

  private tituloFrequencia(status: StatusFrequencia): string {
    if (status === StatusFrequencia.PRESENTE) return 'Presenca registrada';
    if (status === StatusFrequencia.FALTA_JUSTIFICADA) return 'Falta justificada';
    return 'Falta registrada';
  }

  private tituloAtendimento(tipoRegistro: TipoRegistroAtendimentoIndividual): string {
    if (tipoRegistro === TipoRegistroAtendimentoIndividual.ATENDIMENTO_REALIZADO) {
      return 'Atendimento individual realizado';
    }
    if (tipoRegistro === TipoRegistroAtendimentoIndividual.CANCELADO) {
      return 'Atendimento individual cancelado';
    }
    return 'Falta em atendimento individual';
  }

  private formatarDataCurta(date: Date): string {
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  }
}
