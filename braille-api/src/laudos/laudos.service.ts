import { Injectable, NotFoundException, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLaudoDto } from './dto/create-laudo.dto';
import { UpdateLaudoDto } from './dto/update-laudo.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAcao } from '@prisma/client';
import { AuditUser } from '../common/interfaces/audit-user.interface';

@Injectable()
export class LaudosService {
  private readonly logger = new Logger(LaudosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditLogService,
  ) {}

  async criar(alunoId: string, dto: CreateLaudoDto, auditUser: AuditUser) {
    const aluno = await this.prisma.aluno.findUnique({
      where: { id: alunoId },
    });
    if (!aluno) {
      throw new NotFoundException('Aluno nao encontrado.');
    }

    try {
      const laudo = await this.prisma.laudoMedico.create({
        data: {
          alunoId: aluno.id,
          dataEmissao: new Date(dto.dataEmissao),
          medicoResponsavel: dto.medicoResponsavel,
          descricao: dto.descricao,
          arquivoUrl: dto.arquivoUrl,
          registradoPorId: auditUser.sub,
        },
      });

      this.registrarAuditoria({
        entidade: 'LaudoMedico',
        registroId: laudo.id,
        acao: AuditAcao.CRIAR,
        auditUser,
        newValue: laudo,
      });

      return laudo;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : JSON.stringify(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`[Data Leak Guard] Falha catastrofica ao criar laudo no DB: ${msg}`, stack);
      throw new InternalServerErrorException('Ocorreu um erro interno ao salvar o laudo.');
    }
  }

  async listarPorAluno(alunoId: string) {
    return this.prisma.laudoMedico.findMany({
      where: { alunoId, excluidoEm: null },
      orderBy: { dataEmissao: 'desc' },
    });
  }

  async atualizar(id: string, dto: UpdateLaudoDto, auditUser: AuditUser) {
    const laudo = await this.buscarLaudoAtivo(id);

    try {
      const laudoAtualizado = await this.prisma.laudoMedico.update({
        where: { id },
        data: {
          ...(dto.dataEmissao ? { dataEmissao: new Date(dto.dataEmissao) } : {}),
          ...(dto.medicoResponsavel === undefined ? {} : { medicoResponsavel: dto.medicoResponsavel }),
          ...(dto.descricao === undefined ? {} : { descricao: dto.descricao }),
          ...(dto.arquivoUrl === undefined ? {} : { arquivoUrl: dto.arquivoUrl }),
        },
      });

      this.registrarAuditoria({
        entidade: 'LaudoMedico',
        registroId: laudo.id,
        acao: AuditAcao.ATUALIZAR,
        auditUser,
        oldValue: laudo,
        newValue: laudoAtualizado,
      });

      return laudoAtualizado;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : JSON.stringify(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`[Data Leak Guard] Falha ao atualizar laudo: ${msg}`, stack);
      throw new InternalServerErrorException('Falha ao atualizar metadados do laudo.');
    }
  }

  async remover(id: string, auditUser: AuditUser) {
    const laudo = await this.buscarLaudoAtivo(id);

    try {
      const laudoRevogado = await this.prisma.laudoMedico.update({
        where: { id },
        data: {
          excluidoEm: new Date(),
          excluidoPorId: auditUser.sub,
        },
      });

      this.registrarAuditoria({
        entidade: 'LaudoMedico',
        registroId: laudo.id,
        acao: AuditAcao.EXCLUIR,
        auditUser,
        oldValue: laudo,
        newValue: laudoRevogado,
      });

      return { message: 'Laudo removido da listagem e preservado no historico medico.' };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : JSON.stringify(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`[Data Leak Guard] Falha ao revogar laudo: ${msg}`, stack);
      throw new InternalServerErrorException('Nao foi possivel excluir o laudo devido a restricoes sistemicas.');
    }
  }

  private async buscarLaudoAtivo(id: string) {
    const laudo = await this.prisma.laudoMedico.findUnique({
      where: { id },
    });

    if (!laudo || laudo.excluidoEm) {
      throw new NotFoundException('Laudo nao encontrado.');
    }

    return laudo;
  }

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
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : JSON.stringify(error);
        this.logger.warn(`Falha na auditoria do laudo ${registroId}: ${msg}`);
      });
  }
}
