import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditUser } from '../common/interfaces/audit-user.interface';
import { CreateAtestadoDto } from './dto/create-atestado.dto';
import { UpdateAtestadoDto } from './dto/update-atestado.dto';
import { StatusFrequencia, Aluno, AuditAcao, VisibilidadeEventoLinhaTempo } from '@prisma/client';
import { ApiResponse } from '../common/dto/api-response.dto';
import { EventoLinhaTempoService } from '../aluno-linha-tempo/evento-linha-tempo.service';

// ── Select de Frequência Vinculada ─────────────────────────────────────────────
/** Select mínimo reutilizado nas queries de frequências vinculadas ao atestado. */
const FREQUENCIA_SELECT = {
  id: true,
  dataAula: true,
  status: true,
  turma: { select: { id: true, nome: true } },
} as const;

// ── Service ────────────────────────────────────────────────────────────────────

@Injectable()
export class AtestadosService {
  private readonly logger = new Logger(AtestadosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
    private readonly auditService: AuditLogService,
    private readonly eventoLinhaTempo?: EventoLinhaTempoService,
  ) {}

  // ── Métodos Públicos ────────────────────────────────────────────────────────

  private registrarAuditoria(params: {
    entidade: string;
    registroId: string;
    acao: AuditAcao;
    auditUser: AuditUser;
    oldValue?: unknown;
    newValue?: unknown;
  }): void {
    const { entidade, registroId, acao, auditUser, oldValue, newValue } = params;

    this.auditService
      .registrar({
        entidade,
        registroId,
        acao,
        autorId: auditUser.sub,
        autorNome: auditUser.nome,
        autorRole: auditUser.role,
        ip: auditUser.ip,
        userAgent: auditUser.userAgent,
        oldValue,
        newValue,
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : JSON.stringify(err);
        this.logger.warn(`Falha na auditoria de atestado ${registroId}: ${msg}`);
      });
  }

  /**
   * Registra um novo atestado e justifica automaticamente as faltas do aluno
   * no período informado.
   *
   * ACID: create + updateMany executados em prisma.$transaction — se qualquer
   * operação falhar, nenhuma alteração é persistida.
   */
  async criar(alunoId: string, dto: CreateAtestadoDto, auditUser: AuditUser): Promise<ApiResponse<unknown>> {
    await this.validarAluno(alunoId); // cláusula de guarda — 404 se não existir

    const inicio = new Date(dto.dataInicio);
    const fim = new Date(dto.dataFim);

    this.validarIntervaloData(inicio, fim);

    // $transaction garante ACID: se updateMany falhar, o create é revertido
    const [atestado, frequenciasAtualizadas, frequenciasJustificadas] = await this.prisma.$transaction(async (tx) => {
      const novoAtestado = await tx.atestado.create({
        data: {
          alunoId,
          dataInicio: inicio,
          dataFim: fim,
          motivo: dto.motivo,
          arquivoUrl: dto.arquivoUrl,
          registradoPorId: auditUser.sub,
        },
      });

      const faltasParaJustificar = await tx.frequencia.findMany({
        where: {
          alunoId,
          dataAula: { gte: inicio, lte: fim },
          status: StatusFrequencia.FALTA,
        },
        select: {
          id: true,
          alunoId: true,
          turmaId: true,
          dataAula: true,
          fechado: true,
          turma: { select: { nome: true, professor: { select: { nome: true } } } },
        },
      });

      const resultado = await tx.frequencia.updateMany({
        where: {
          alunoId,
          dataAula: { gte: inicio, lte: fim },
          status: StatusFrequencia.FALTA,
        },
        data: {
          status: StatusFrequencia.FALTA_JUSTIFICADA,
          justificativaId: novoAtestado.id,
        },
      });

      return [novoAtestado, resultado, faltasParaJustificar] as const;
    });

    this.registrarAuditoria({
      entidade: 'Atestado',
      registroId: atestado.id,
      acao: AuditAcao.CRIAR,
      auditUser,
      newValue: { atestado, faltasJustificadas: frequenciasAtualizadas.count },
    });

    await this.eventoLinhaTempo?.registrarEvento({
      alunoId,
      usuarioId: auditUser.sub,
      tipo: 'ATESTADO',
      origem: 'ATESTADO',
      origemId: atestado.id,
      chaveEvento: `ATESTADO:${atestado.id}:CRIADO`,
      dataEvento: atestado.criadoEm,
      titulo: 'Atestado registrado',
      descricao: `Periodo: ${this.formatarDataCurta(atestado.dataInicio)} a ${this.formatarDataCurta(atestado.dataFim)}. Motivo: ${atestado.motivo}.`,
      usuarioNomeSnapshot: auditUser.nome,
      metadata: {
        dataInicio: atestado.dataInicio.toISOString(),
        dataFim: atestado.dataFim.toISOString(),
        faltasJustificadas: frequenciasAtualizadas.count,
      },
      visibilidade: VisibilidadeEventoLinhaTempo.RESTRITA,
      sensivel: true,
    });

    for (const frequencia of frequenciasJustificadas) {
      await this.eventoLinhaTempo?.registrarEvento({
        alunoId: frequencia.alunoId,
        turmaId: frequencia.turmaId,
        usuarioId: auditUser.sub,
        tipo: 'FREQUENCIA_FALTA_JUSTIFICADA',
        origem: 'FREQUENCIA',
        origemId: frequencia.id,
        chaveEvento: `FREQUENCIA:${frequencia.id}:STATUS`,
        dataEvento: frequencia.dataAula,
        titulo: 'Falta justificada',
        descricao: `Falta justificada por atestado na turma ${frequencia.turma.nome}.`,
        turmaNomeSnapshot: frequencia.turma.nome,
        professorNomeSnapshot: frequencia.turma.professor?.nome,
        usuarioNomeSnapshot: auditUser.nome,
        metadata: {
          status: StatusFrequencia.FALTA_JUSTIFICADA,
          fechado: frequencia.fechado,
          justificadaPorAtestado: true,
          atestadoId: atestado.id,
        },
      });
    }

    return new ApiResponse(
      true,
      { atestado, faltasJustificadas: frequenciasAtualizadas.count },
      `Atestado registrado. ${frequenciasAtualizadas.count} falta(s) justificada(s) automaticamente.`,
    );
  }

  /**
   * Retorna todos os atestados de um aluno com as frequências vinculadas.
   */
  async listarPorAluno(alunoId: string): Promise<ApiResponse<unknown>> {
    await this.validarAluno(alunoId);

    const atestados = await this.prisma.atestado.findMany({
      where: { alunoId },
      orderBy: { dataInicio: 'desc' },
      include: { frequencias: { select: FREQUENCIA_SELECT } },
    });

    return new ApiResponse(true, atestados);
  }

  /**
   * Retorna o detalhe completo de um atestado com aluno e frequências vinculadas.
   */
  async findOne(id: string): Promise<ApiResponse<unknown>> {
    const atestado = await this.prisma.atestado.findUnique({
      where: { id },
      include: {
        aluno: { select: { id: true, nomeCompleto: true, matricula: true } },
        frequencias: { select: FREQUENCIA_SELECT },
      },
    });

    if (!atestado) throw new NotFoundException('Atestado não encontrado.');

    return new ApiResponse(true, atestado);
  }

  /**
   * Atualiza motivo e/ou URL do arquivo do atestado.
   * Datas (dataInicio/dataFim) não são alteráveis após criação.
   * Remove arquivo antigo do Cloudinary se a URL for substituída.
   */
  async atualizar(id: string, dto: UpdateAtestadoDto, auditUser: AuditUser): Promise<ApiResponse<unknown>> {
    const atestado = await this.prisma.atestado.findUnique({ where: { id } });
    if (!atestado) throw new NotFoundException('Atestado não encontrado.');

    // Remove o arquivo antigo do Cloudinary se estiver a ser substituído
    if (dto.arquivoUrl && atestado.arquivoUrl && dto.arquivoUrl !== atestado.arquivoUrl) {
      try {
        await this.uploadService.deleteFile(atestado.arquivoUrl);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : JSON.stringify(err);
        this.logger.warn(`Arquivo antigo não removido do Cloudinary: ${msg}`);
      }
    }

    const atestadoAtualizado = await this.prisma.atestado.update({
      where: { id },
      data: {
        ...(dto.motivo !== undefined && { motivo: dto.motivo }),
        ...(dto.arquivoUrl !== undefined && { arquivoUrl: dto.arquivoUrl }),
      },
      include: { frequencias: { select: FREQUENCIA_SELECT } },
    });

    this.registrarAuditoria({
      entidade: 'Atestado',
      registroId: id,
      acao: AuditAcao.ATUALIZAR,
      auditUser,
      oldValue: atestado,
      newValue: atestadoAtualizado,
    });

    return new ApiResponse(true, atestadoAtualizado, 'Atestado atualizado com sucesso.');
  }

  /**
   * Remove um atestado e reverte as faltas justificadas de volta para FALTA.
   *
   * Autorização: verificada na camada HTTP via @Roles(ADMIN, SECRETARIA) —
   * o Service não recebe nem valida Role (DIP correto).
   *
   * ACID: updateMany + delete executados em $transaction — se o delete falhar,
   * as frequências não são revertidas.
   */
  async remover(id: string, auditUser: AuditUser): Promise<ApiResponse<unknown>> {
    const atestado = await this.prisma.atestado.findUnique({ where: { id } });
    if (!atestado) throw new NotFoundException('Atestado não encontrado.');

    // $transaction garante ACID: reversão de frequências + exclusão são atômicas
    const [revertidas] = await this.prisma.$transaction(async (tx) => {
      const resultado = await tx.frequencia.updateMany({
        where: { justificativaId: id },
        data: { status: StatusFrequencia.FALTA, justificativaId: null },
      });

      await tx.atestado.delete({ where: { id } });

      return [resultado] as const;
    });

    this.registrarAuditoria({
      entidade: 'Atestado',
      registroId: id,
      acao: AuditAcao.EXCLUIR,
      auditUser,
      oldValue: { atestado, faltasRevertidas: revertidas.count },
      newValue: null,
    });

    return new ApiResponse(
      true,
      { id, revertidas: revertidas.count },
      `Atestado removido. ${revertidas.count} falta(s) revertida(s) para FALTA.`,
    );
  }

  /**
   * Simula quais faltas serão justificadas pelo atestado (preview sem escrita).
   * Valida intervalo de datas antes de consultar o banco.
   */
  async previewJustificativas(alunoId: string, dataInicio: string, dataFim: string): Promise<ApiResponse<unknown>> {
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);

    // Cláusulas de guarda: datas inválidas ou intervalo invertido
    if (isNaN(inicio.getTime())) {
      throw new BadRequestException('dataInicio inválida. Use o formato YYYY-MM-DD.');
    }
    if (isNaN(fim.getTime())) {
      throw new BadRequestException('dataFim inválida. Use o formato YYYY-MM-DD.');
    }
    this.validarIntervaloData(inicio, fim);

    const faltas = await this.prisma.frequencia.findMany({
      where: {
        alunoId,
        dataAula: { gte: inicio, lte: fim },
        status: StatusFrequencia.FALTA,
      },
      select: { id: true, dataAula: true, turma: { select: { nome: true } } },
      orderBy: { dataAula: 'asc' },
    });

    return new ApiResponse(true, {
      totalFaltasNoPeriodo: faltas.length,
      faltas,
    });
  }

  // ── Helpers Privados ────────────────────────────────────────────────────────

  /**
   * Verifica se o aluno existe — fonte única de verdade, elimina
   * a duplicação de findUnique em criar() e listarPorAluno().
   */
  private async validarAluno(alunoId: string): Promise<Aluno> {
    const aluno = await this.prisma.aluno.findUnique({ where: { id: alunoId } });
    if (!aluno) throw new NotFoundException('Aluno não encontrado.');
    return aluno;
  }

  /**
   * Verifica que o intervalo de datas é válido (fim >= inicio).
   * Cláusula de guarda reutilizada em criar() e previewJustificativas().
   */
  private validarIntervaloData(inicio: Date, fim: Date): void {
    if (fim < inicio) {
      throw new BadRequestException('A data de fim não pode ser anterior à data de início.');
    }
  }

  private formatarDataCurta(date: Date): string {
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  }
}
