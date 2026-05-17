import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAcao,
  MatriculaStatus,
  Prisma,
  Role,
  StatusFrequencia,
  TipoRegistroAtendimentoIndividual,
} from '@prisma/client';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import { PrismaService } from '../prisma/prisma.service';
import { LinhaTempoAlunoItem, TipoEventoLinhaTempoAluno } from './aluno-linha-tempo.types';
import { QueryLinhaTempoAlunoDto } from './dto/query-linha-tempo-aluno.dto';

const TIPOS_LINHA_TEMPO: readonly TipoEventoLinhaTempoAluno[] = [
  'CADASTRO',
  'ATUALIZACAO_CADASTRO',
  'MATRICULA_TURMA',
  'ENCERRAMENTO_MATRICULA',
  'FREQUENCIA_PRESENTE',
  'FREQUENCIA_FALTA',
  'FREQUENCIA_FALTA_JUSTIFICADA',
  'ATENDIMENTO_INDIVIDUAL',
  'FALTA_ATENDIMENTO',
  'ATESTADO',
  'LAUDO',
  'CERTIFICADO',
  'PDI_CRIADO',
  'PDI_META_ATUALIZADA',
  'PDI_EVOLUCAO',
  'ACAO_RISCO_EVASAO',
  'INATIVACAO',
  'REATIVACAO',
] as const;

type Periodo = {
  inicio?: Date;
  fim?: Date;
};

@Injectable()
export class AlunoLinhaTempoService {
  constructor(private readonly prisma: PrismaService) {}

  async findByAluno(alunoId: string, query: QueryLinhaTempoAlunoDto, user?: AuthenticatedUser) {
    const { page, limit, skip } = this.normalizarPaginacao(query.page, query.limit);
    const periodo = this.normalizarPeriodo(query.dataInicio, query.dataFim);
    const tipos = this.normalizarTipos(query.tipo);

    const aluno = await this.prisma.aluno.findFirst({
      where: { id: alunoId, excluido: false },
      select: {
        id: true,
        nomeCompleto: true,
        criadoEm: true,
        atualizadoEm: true,
        statusAtivo: true,
        motivoInativacao: true,
        observacaoInativacao: true,
        inativadoEm: true,
        reativadoEm: true,
        motivoReativacao: true,
      },
    });

    if (!aluno) throw new NotFoundException('Aluno nao encontrado.');
    await this.garantirPermissao(alunoId, user);

    const [
      matriculas,
      frequencias,
      atendimentos,
      atestados,
      laudos,
      certificados,
      pdis,
      acoesRisco,
      auditoriasCadastro,
    ] = await Promise.all([
      this.buscarMatriculas(alunoId, query.turmaId),
      this.buscarFrequencias(alunoId, query.turmaId, periodo),
      this.buscarAtendimentos(alunoId, periodo),
      this.buscarAtestados(alunoId, periodo),
      this.buscarLaudos(alunoId, periodo),
      this.buscarCertificados(alunoId, query.turmaId, periodo),
      this.buscarPdis(alunoId, periodo),
      this.buscarAcoesRisco(alunoId, query.turmaId, periodo),
      this.buscarAuditoriasCadastro(alunoId, periodo),
    ]);

    const eventos: LinhaTempoAlunoItem[] = [];

    this.pushEvento(eventos, {
      id: `cadastro-${aluno.id}`,
      tipo: 'CADASTRO',
      data: aluno.criadoEm,
      titulo: 'Aluno cadastrado',
      descricao: `Cadastro de ${aluno.nomeCompleto} realizado no sistema.`,
      origem: 'Aluno',
      alunoId,
    }, periodo, tipos);

    if (aluno.inativadoEm) {
      this.pushEvento(eventos, {
        id: `inativacao-${aluno.id}`,
        tipo: 'INATIVACAO',
        data: aluno.inativadoEm,
        titulo: 'Aluno inativado',
        descricao: `Motivo: ${this.formatarEnum(aluno.motivoInativacao) || 'Nao informado'}. ${aluno.observacaoInativacao || ''}`.trim(),
        origem: 'Aluno',
        alunoId,
        metadata: { motivoInativacao: aluno.motivoInativacao },
      }, periodo, tipos);
    }

    if (aluno.reativadoEm) {
      this.pushEvento(eventos, {
        id: `reativacao-${aluno.id}`,
        tipo: 'REATIVACAO',
        data: aluno.reativadoEm,
        titulo: 'Aluno reativado',
        descricao: aluno.motivoReativacao || 'Aluno reativado na instituicao.',
        origem: 'Aluno',
        alunoId,
      }, periodo, tipos);
    }

    for (const audit of auditoriasCadastro) {
      this.pushEvento(eventos, {
        id: `audit-aluno-${audit.id}`,
        tipo: 'ATUALIZACAO_CADASTRO',
        data: audit.criadoEm,
        titulo: 'Cadastro atualizado',
        descricao: 'Dados cadastrais do aluno foram atualizados.',
        origem: 'AuditLog',
        alunoId,
        usuarioNome: audit.autorNome || undefined,
        metadata: { acao: audit.acao },
      }, periodo, tipos);
    }

    for (const matricula of matriculas) {
      this.pushEvento(eventos, {
        id: `matricula-${matricula.id}`,
        tipo: 'MATRICULA_TURMA',
        data: matricula.dataEntrada,
        titulo: 'Matricula em turma',
        descricao: `Aluno matriculado na turma ${matricula.turma.nome}.`,
        origem: 'MatriculaOficina',
        alunoId,
        turmaId: matricula.turma.id,
        turmaNome: matricula.turma.nome,
        professorNome: matricula.turma.professor?.nome,
        metadata: { status: matricula.status },
      }, periodo, tipos);

      if (matricula.status !== MatriculaStatus.ATIVA && (matricula.dataEncerramento || matricula.encerradoEm)) {
        this.pushEvento(eventos, {
          id: `encerramento-${matricula.id}`,
          tipo: 'ENCERRAMENTO_MATRICULA',
          data: matricula.dataEncerramento || matricula.encerradoEm,
          titulo: `Matricula ${this.formatarEnum(matricula.status).toLowerCase()}`,
          descricao: `Motivo: ${this.formatarEnum(matricula.motivoEncerramento) || 'Nao informado'}. ${matricula.observacao || ''}`.trim(),
          origem: 'MatriculaOficina',
          alunoId,
          turmaId: matricula.turma.id,
          turmaNome: matricula.turma.nome,
          professorNome: matricula.turma.professor?.nome,
          metadata: {
            status: matricula.status,
            motivoEncerramento: matricula.motivoEncerramento,
          },
        }, periodo, tipos);
      }
    }

    for (const frequencia of frequencias) {
      const tipo = this.tipoFrequencia(frequencia.status);
      this.pushEvento(eventos, {
        id: `frequencia-${frequencia.id}`,
        tipo,
        data: frequencia.dataAula,
        titulo: this.tituloFrequencia(frequencia.status),
        descricao: frequencia.observacao || `Registro de chamada na turma ${frequencia.turma.nome}.`,
        origem: 'Frequencia',
        alunoId,
        turmaId: frequencia.turma.id,
        turmaNome: frequencia.turma.nome,
        professorNome: frequencia.turma.professor?.nome,
        metadata: {
          status: frequencia.status,
          fechado: frequencia.fechado,
          justificadaPorAtestado: Boolean(frequencia.justificativaId),
        },
      }, periodo, tipos);
    }

    for (const atendimento of atendimentos) {
      const falta = atendimento.tipoRegistro === TipoRegistroAtendimentoIndividual.FALTA_JUSTIFICADA
        || atendimento.tipoRegistro === TipoRegistroAtendimentoIndividual.FALTA_NAO_JUSTIFICADA;
      this.pushEvento(eventos, {
        id: `atendimento-${atendimento.id}`,
        tipo: falta ? 'FALTA_ATENDIMENTO' : 'ATENDIMENTO_INDIVIDUAL',
        data: atendimento.dataAtendimento,
        titulo: falta ? 'Falta em atendimento individual' : 'Atendimento individual realizado',
        descricao: atendimento.assuntoDoDia || atendimento.evolucao || atendimento.observacao || atendimento.acompanhamento.assuntoAtual,
        origem: 'AtendimentoIndividual',
        alunoId,
        professorNome: atendimento.professor?.nome,
        usuarioNome: atendimento.criadoPor?.nome,
        metadata: {
          tipoRegistro: atendimento.tipoRegistro,
          modalidade: atendimento.modalidade,
          duracaoMinutos: atendimento.duracaoMinutos,
          acompanhamentoId: atendimento.acompanhamentoId,
        },
      }, periodo, tipos);
    }

    for (const atestado of atestados) {
      this.pushEvento(eventos, {
        id: `atestado-${atestado.id}`,
        tipo: 'ATESTADO',
        data: atestado.criadoEm,
        titulo: 'Atestado registrado',
        descricao: `Periodo: ${this.formatarDataCurta(atestado.dataInicio)} a ${this.formatarDataCurta(atestado.dataFim)}. Motivo: ${atestado.motivo}.`,
        origem: 'Atestado',
        alunoId,
        metadata: {
          dataInicio: atestado.dataInicio.toISOString(),
          dataFim: atestado.dataFim.toISOString(),
          faltasJustificadas: atestado.frequencias.length,
        },
      }, periodo, tipos);
    }

    const podeVerDetalheSensivel = user?.role === Role.ADMIN || user?.role === Role.SECRETARIA;
    for (const laudo of laudos) {
      this.pushEvento(eventos, {
        id: `laudo-${laudo.id}`,
        tipo: 'LAUDO',
        data: laudo.criadoEm,
        titulo: 'Laudo medico registrado',
        descricao: podeVerDetalheSensivel
          ? (laudo.descricao || `Data de emissao: ${this.formatarDataCurta(laudo.dataEmissao)}.`)
          : 'Documento sensivel registrado. Detalhes restritos a secretaria e administracao.',
        origem: 'LaudoMedico',
        alunoId,
        metadata: podeVerDetalheSensivel
          ? { dataEmissao: laudo.dataEmissao.toISOString(), medicoResponsavel: laudo.medicoResponsavel }
          : { sensivel: true },
      }, periodo, tipos);
    }

    for (const certificado of certificados) {
      this.pushEvento(eventos, {
        id: `certificado-${certificado.id}`,
        tipo: 'CERTIFICADO',
        data: certificado.dataEmissao,
        titulo: 'Certificado emitido',
        descricao: certificado.cursoImpresso || certificado.turma?.nome || certificado.modelo.nome,
        origem: 'CertificadoEmitido',
        alunoId,
        turmaId: certificado.turma?.id,
        turmaNome: certificado.turma?.nome,
        metadata: {
          codigoValidacao: certificado.codigoValidacao,
          status: certificado.status,
          modelo: certificado.modelo.nome,
        },
      }, periodo, tipos);
    }

    for (const pdi of pdis) {
      this.pushEvento(eventos, {
        id: `pdi-${pdi.id}`,
        tipo: 'PDI_CRIADO',
        data: pdi.criadoEm,
        titulo: 'PDI criado',
        descricao: pdi.objetivoGeral,
        origem: 'PdiAluno',
        alunoId,
        professorNome: pdi.professorResponsavel?.nome,
        metadata: { status: pdi.status, titulo: pdi.titulo },
      }, periodo, tipos);

      for (const meta of pdi.metas) {
        this.pushEvento(eventos, {
          id: `pdi-meta-${meta.id}`,
          tipo: 'PDI_META_ATUALIZADA',
          data: meta.atualizadoEm,
          titulo: 'Meta do PDI atualizada',
          descricao: meta.descricao,
          origem: 'PdiMeta',
          alunoId,
          professorNome: pdi.professorResponsavel?.nome,
          metadata: { area: meta.area, status: meta.status, pdiId: pdi.id },
        }, periodo, tipos);
      }

      for (const evolucao of pdi.evolucoes) {
        this.pushEvento(eventos, {
          id: `pdi-evolucao-${evolucao.id}`,
          tipo: 'PDI_EVOLUCAO',
          data: evolucao.dataRegistro,
          titulo: 'Evolucao registrada no PDI',
          descricao: evolucao.avancos || evolucao.descricao,
          origem: 'PdiEvolucao',
          alunoId,
          professorNome: pdi.professorResponsavel?.nome,
          usuarioNome: evolucao.registradoPor?.nome,
          metadata: { pdiId: pdi.id },
        }, periodo, tipos);
      }
    }

    for (const acao of acoesRisco) {
      this.pushEvento(eventos, {
        id: `acao-risco-${acao.id}`,
        tipo: 'ACAO_RISCO_EVASAO',
        data: acao.criadoEm,
        titulo: 'Acao de risco de evasao criada',
        descricao: acao.resultado || acao.descricao || acao.motivoRisco,
        origem: 'AcaoRiscoEvasao',
        alunoId,
        turmaId: acao.turma?.id,
        turmaNome: acao.turma?.nome,
        usuarioNome: acao.responsavel?.nome,
        metadata: {
          nivel: acao.nivel,
          status: acao.status,
          tipoAcao: acao.tipoAcao,
          prazo: acao.prazo?.toISOString(),
        },
      }, periodo, tipos);
    }

    eventos.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    const total = eventos.length;
    return {
      data: eventos.slice(skip, skip + limit),
      meta: {
        page,
        limit,
        total,
        lastPage: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  private buscarMatriculas(alunoId: string, turmaId?: string) {
    return this.prisma.matriculaOficina.findMany({
      where: { alunoId, ...(turmaId && { turmaId }) },
      include: {
        turma: {
          select: {
            id: true,
            nome: true,
            professorId: true,
            professorAuxiliarId: true,
            professor: { select: { id: true, nome: true } },
          },
        },
      },
      take: 300,
      orderBy: { dataEntrada: 'desc' },
    });
  }

  private buscarFrequencias(alunoId: string, turmaId: string | undefined, periodo: Periodo) {
    return this.prisma.frequencia.findMany({
      where: {
        alunoId,
        ...(turmaId && { turmaId }),
        dataAula: this.periodoWhere(periodo),
      },
      include: {
        turma: {
          select: {
            id: true,
            nome: true,
            professorId: true,
            professorAuxiliarId: true,
            professor: { select: { id: true, nome: true } },
          },
        },
      },
      take: 500,
      orderBy: { dataAula: 'desc' },
    });
  }

  private buscarAtendimentos(alunoId: string, periodo: Periodo) {
    return this.prisma.atendimentoIndividual.findMany({
      where: {
        alunoId,
        excluidoEm: null,
        dataAtendimento: this.periodoWhere(periodo),
      },
      include: {
        professor: { select: { id: true, nome: true } },
        criadoPor: { select: { id: true, nome: true } },
        acompanhamento: { select: { id: true, assuntoAtual: true } },
      },
      take: 300,
      orderBy: { dataAtendimento: 'desc' },
    });
  }

  private buscarAtestados(alunoId: string, periodo: Periodo) {
    return this.prisma.atestado.findMany({
      where: { alunoId, criadoEm: this.periodoWhere(periodo) },
      include: { frequencias: { select: { id: true } } },
      take: 120,
      orderBy: { criadoEm: 'desc' },
    });
  }

  private buscarLaudos(alunoId: string, periodo: Periodo) {
    return this.prisma.laudoMedico.findMany({
      where: { alunoId, excluidoEm: null, criadoEm: this.periodoWhere(periodo) },
      take: 120,
      orderBy: { criadoEm: 'desc' },
    });
  }

  private buscarCertificados(alunoId: string, turmaId: string | undefined, periodo: Periodo) {
    return this.prisma.certificadoEmitido.findMany({
      where: {
        alunoId,
        ...(turmaId && { turmaId }),
        dataEmissao: this.periodoWhere(periodo),
      },
      include: {
        turma: { select: { id: true, nome: true } },
        modelo: { select: { id: true, nome: true, tipo: true } },
      },
      take: 200,
      orderBy: { dataEmissao: 'desc' },
    });
  }

  private buscarPdis(alunoId: string, periodo: Periodo) {
    return this.prisma.pdiAluno.findMany({
      where: { alunoId },
      include: {
        professorResponsavel: { select: { id: true, nome: true } },
        metas: {
          where: { atualizadoEm: this.periodoWhere(periodo) },
          orderBy: { atualizadoEm: 'desc' },
        },
        evolucoes: {
          where: { dataRegistro: this.periodoWhere(periodo) },
          include: { registradoPor: { select: { id: true, nome: true } } },
          orderBy: { dataRegistro: 'desc' },
        },
      },
      take: 100,
      orderBy: { criadoEm: 'desc' },
    });
  }

  private buscarAcoesRisco(alunoId: string, turmaId: string | undefined, periodo: Periodo) {
    return this.prisma.acaoRiscoEvasao.findMany({
      where: {
        alunoId,
        ...(turmaId && { turmaId }),
        criadoEm: this.periodoWhere(periodo),
      },
      include: {
        turma: { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true } },
      },
      take: 200,
      orderBy: { criadoEm: 'desc' },
    });
  }

  private buscarAuditoriasCadastro(alunoId: string, periodo: Periodo) {
    return this.prisma.auditLog.findMany({
      where: {
        entidade: 'Aluno',
        registroId: alunoId,
        acao: AuditAcao.ATUALIZAR,
        criadoEm: this.periodoWhere(periodo),
      },
      select: {
        id: true,
        acao: true,
        autorNome: true,
        criadoEm: true,
      },
      take: 80,
      orderBy: { criadoEm: 'desc' },
    });
  }

  private async garantirPermissao(alunoId: string, user?: AuthenticatedUser): Promise<void> {
    if (!user) throw new ForbiddenException('Usuario nao autenticado.');
    if (user.role === Role.ADMIN || user.role === Role.SECRETARIA) return;
    if (user.role !== Role.PROFESSOR) throw new ForbiddenException('Perfil sem acesso a linha do tempo individual.');

    const vinculo = await this.prisma.aluno.findFirst({
      where: {
        id: alunoId,
        excluido: false,
        OR: [
          {
            matriculasOficina: {
              some: {
                turma: {
                  OR: [{ professorId: user.sub }, { professorAuxiliarId: user.sub }],
                },
              },
            },
          },
          { acompanhamentosIndividuais: { some: { professorId: user.sub, excluidoEm: null } } },
          { atendimentosIndividuais: { some: { professorId: user.sub, excluidoEm: null } } },
          { pdis: { some: { professorResponsavelId: user.sub } } },
        ],
      },
      select: { id: true },
    });

    if (!vinculo) throw new ForbiddenException('Professor sem vinculo com este aluno.');
  }

  private pushEvento(
    eventos: LinhaTempoAlunoItem[],
    evento: Omit<LinhaTempoAlunoItem, 'data'> & { data?: Date | null },
    periodo: Periodo,
    tipos: Set<TipoEventoLinhaTempoAluno> | null,
  ): void {
    if (!evento.data) return;
    if (tipos && !tipos.has(evento.tipo)) return;
    if (!this.dataDentroDoPeriodo(evento.data, periodo)) return;

    eventos.push({
      ...evento,
      data: evento.data.toISOString(),
    });
  }

  private periodoWhere(periodo: Periodo): Prisma.DateTimeFilter | undefined {
    if (!periodo.inicio && !periodo.fim) return undefined;
    return {
      ...(periodo.inicio && { gte: periodo.inicio }),
      ...(periodo.fim && { lte: periodo.fim }),
    };
  }

  private dataDentroDoPeriodo(data: Date, periodo: Periodo): boolean {
    if (periodo.inicio && data < periodo.inicio) return false;
    if (periodo.fim && data > periodo.fim) return false;
    return true;
  }

  private normalizarPeriodo(dataInicio?: string, dataFim?: string): Periodo {
    const inicio = dataInicio ? this.inicioDoDia(new Date(dataInicio)) : undefined;
    const fim = dataFim ? this.fimDoDia(new Date(dataFim)) : undefined;
    if (inicio && fim && inicio > fim) throw new BadRequestException('Data inicial nao pode ser maior que a data final.');
    return { inicio, fim };
  }

  private normalizarTipos(tipo?: string): Set<TipoEventoLinhaTempoAluno> | null {
    if (!tipo?.trim()) return null;
    const tipos = tipo
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);
    const invalidos = tipos.filter((item) => !TIPOS_LINHA_TEMPO.includes(item as TipoEventoLinhaTempoAluno));
    if (invalidos.length) throw new BadRequestException(`Tipo de evento invalido: ${invalidos.join(', ')}.`);
    return new Set(tipos as TipoEventoLinhaTempoAluno[]);
  }

  private normalizarPaginacao(pageValue?: number, limitValue?: number) {
    const page = Number.isFinite(Number(pageValue)) && Number(pageValue) > 0 ? Math.floor(Number(pageValue)) : 1;
    const limit = Number.isFinite(Number(limitValue)) && Number(limitValue) > 0 ? Math.min(100, Math.floor(Number(limitValue))) : 30;
    return { page, limit, skip: (page - 1) * limit };
  }

  private tipoFrequencia(status: StatusFrequencia): TipoEventoLinhaTempoAluno {
    if (status === StatusFrequencia.PRESENTE) return 'FREQUENCIA_PRESENTE';
    if (status === StatusFrequencia.FALTA_JUSTIFICADA) return 'FREQUENCIA_FALTA_JUSTIFICADA';
    return 'FREQUENCIA_FALTA';
  }

  private tituloFrequencia(status: StatusFrequencia): string {
    if (status === StatusFrequencia.PRESENTE) return 'Presenca registrada';
    if (status === StatusFrequencia.FALTA_JUSTIFICADA) return 'Falta justificada';
    return 'Falta registrada';
  }

  private formatarEnum(value?: string | null): string {
    if (!value) return '';
    return value
      .toLowerCase()
      .split('_')
      .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
      .join(' ');
  }

  private formatarDataCurta(date: Date): string {
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  }

  private inicioDoDia(date: Date): Date {
    const clone = new Date(date);
    clone.setUTCHours(0, 0, 0, 0);
    return clone;
  }

  private fimDoDia(date: Date): Date {
    const clone = new Date(date);
    clone.setUTCHours(23, 59, 59, 999);
    return clone;
  }
}
