import { Injectable, NotFoundException, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLaudoDto } from './dto/create-laudo.dto';
import { UpdateLaudoDto } from './dto/update-laudo.dto';
import { UploadService } from '../upload/upload.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAcao } from '@prisma/client';
import { AuditUser } from '../common/interfaces/audit-user.interface';

@Injectable()
export class LaudosService {
  private readonly logger = new Logger(LaudosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
    private readonly auditService: AuditLogService,
  ) {}

  async criar(alunoId: string, dto: CreateLaudoDto, auditUser: AuditUser) {
    const aluno = await this.prisma.aluno.findUnique({
      where: { id: alunoId },
    });
    if (!aluno) {
      throw new NotFoundException('Aluno não encontrado.');
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

      this.auditService.registrar({
        entidade: 'LaudoMedico',
        registroId: laudo.id,
        acao: AuditAcao.CRIAR,
        autorId: auditUser.sub,
        autorNome: auditUser.nome,
        autorRole: auditUser.role,
        ip: auditUser.ip,
        userAgent: auditUser.userAgent,
        newValue: laudo,
      }).catch(e => this.logger.warn(`Falha na auditoria ao criar laudo do aluno ${aluno.id}: ${e.message}`));

      return laudo;
    } catch (error: any) {
      this.logger.error(`[Data Leak Guard] Falha catastrófica ao criar laudo no DB: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Ocorreu um erro interno ao salvar o laudo.');
    }
  }

  async listarPorAluno(alunoId: string) {
    const laudos = await this.prisma.laudoMedico.findMany({
      where: { alunoId },
      orderBy: { dataEmissao: 'desc' },
    });
    return laudos;
  }

  async atualizar(id: string, dto: UpdateLaudoDto, auditUser: AuditUser) {
    const laudo = await this.prisma.laudoMedico.findUnique({
      where: { id },
    });

    if (!laudo) {
      throw new NotFoundException('Laudo não encontrado.');
    }

    if (dto.arquivoUrl && laudo.arquivoUrl && dto.arquivoUrl !== laudo.arquivoUrl) {
      try {
        await this.uploadService.deleteFile(laudo.arquivoUrl);
      } catch (e: any) {
        this.logger.warn(`Arquivo antigo (${laudo.arquivoUrl}) não removido do Cloudinary: ${e.message}`);
      }
    }

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

      this.auditService.registrar({
        entidade: 'LaudoMedico',
        registroId: laudo.id,
        acao: AuditAcao.ATUALIZAR,
        autorId: auditUser.sub,
        autorNome: auditUser.nome,
        autorRole: auditUser.role,
        ip: auditUser.ip,
        userAgent: auditUser.userAgent,
        oldValue: laudo,
        newValue: laudoAtualizado,
      }).catch(e => this.logger.warn(`Falha na auditoria ao atualizar laudo ${id}: ${e.message}`));

      return laudoAtualizado;
    } catch (error: any) {
      this.logger.error(`[Data Leak Guard] Falha ao atualizar laudo: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Falha ao atualizar metadados do laudo.');
    }
  }

  async remover(id: string, auditUser: AuditUser) {
    const laudo = await this.prisma.laudoMedico.findUnique({
      where: { id },
    });

    if (!laudo) {
      throw new NotFoundException('Laudo não encontrado.');
    }

    if (laudo.arquivoUrl) {
      try {
        await this.uploadService.deleteFile(laudo.arquivoUrl);
      } catch (e: any) {
        this.logger.warn(`Documento (${laudo.arquivoUrl}) já estava ausente ou erro no Cloudinary: ${e.message}`);
      }
    }

    try {
      await this.prisma.laudoMedico.delete({
        where: { id },
      });

      this.auditService.registrar({
        entidade: 'LaudoMedico',
        registroId: laudo.id,
        acao: AuditAcao.EXCLUIR,
        autorId: auditUser.sub,
        autorNome: auditUser.nome,
        autorRole: auditUser.role,
        ip: auditUser.ip,
        userAgent: auditUser.userAgent,
        oldValue: laudo,
        newValue: null,
      }).catch(e => this.logger.warn(`Falha na auditoria ao excluir laudo ${id}: ${e.message}`));

      return { message: 'Laudo removido com sucesso.' };
    } catch (error: any) {
      this.logger.error(`[Data Leak Guard] Falha ao deletar laudo físico: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Não foi possível excluir o laudo devido a restrições sistêmicas.');
    }
  }
}
