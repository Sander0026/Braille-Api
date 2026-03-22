import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAtestadoDto } from './dto/create-atestado.dto';
import { UpdateAtestadoDto } from './dto/update-atestado.dto';
import { Role, StatusFrequencia } from '@prisma/client';
import { REQUEST } from '@nestjs/core';
import { UploadService } from '../upload/upload.service';

@Injectable()
export class AtestadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
    @Inject(REQUEST) private readonly request: any,
  ) {}

  private getAutorId(): string {
    return this.request.user?.sub;
  }

  // ── Criar Atestado + Justificar Faltas Automaticamente ─────────────────────
  async criar(alunoId: string, dto: CreateAtestadoDto) {
    // Valida se o aluno existe
    const aluno = await this.prisma.aluno.findUnique({ where: { id: alunoId } });
    if (!aluno) throw new NotFoundException('Aluno não encontrado.');

    const inicio = new Date(dto.dataInicio);
    const fim = new Date(dto.dataFim);

    if (fim < inicio) {
      throw new BadRequestException('A data de fim não pode ser anterior à data de início.');
    }

    // Salva o atestado
    const atestado = await this.prisma.atestado.create({
      data: {
        alunoId,
        dataInicio: inicio,
        dataFim: fim,
        motivo: dto.motivo,
        arquivoUrl: dto.arquivoUrl,
        registradoPorId: this.getAutorId(),
      },
    });

    // Justifica automaticamente as faltas no período
    const resultado = await this.prisma.frequencia.updateMany({
      where: {
        alunoId,
        dataAula: { gte: inicio, lte: fim },
        status: StatusFrequencia.FALTA,   // só converte quem está como FALTA
      },
      data: {
        status: StatusFrequencia.FALTA_JUSTIFICADA,
        justificativaId: atestado.id,
      },
    });

    return {
      atestado,
      faltasJustificadas: resultado.count,
      mensagem: `Atestado registrado. ${resultado.count} falta(s) justificada(s) automaticamente.`,
    };
  }

  // ── Listar Atestados de um Aluno ────────────────────────────────────────────
  async listarPorAluno(alunoId: string) {
    const aluno = await this.prisma.aluno.findUnique({ where: { id: alunoId } });
    if (!aluno) throw new NotFoundException('Aluno não encontrado.');

    return this.prisma.atestado.findMany({
      where: { alunoId },
      orderBy: { dataInicio: 'desc' },
      include: {
        frequencias: {
          select: {
            id: true,
            dataAula: true,
            status: true,
            turma: { select: { id: true, nome: true } },
          },
        },
      },
    });
  }

  // ── Detalhe de um Atestado ─────────────────────────────────────────────────
  async findOne(id: string) {
    const atestado = await this.prisma.atestado.findUnique({
      where: { id },
      include: {
        aluno: { select: { id: true, nomeCompleto: true, matricula: true } },
        frequencias: {
          select: {
            id: true,
            dataAula: true,
            status: true,
            turma: { select: { id: true, nome: true } },
          },
        },
      },
    });

    if (!atestado) throw new NotFoundException('Atestado não encontrado.');
    return atestado;
  }

  // ── Atualizar Atestado (apenas Motivo e Arquivo) ─────────────────────────
  async atualizar(id: string, dto: UpdateAtestadoDto) {
    const atestado = await this.prisma.atestado.findUnique({ where: { id } });
    if (!atestado) throw new NotFoundException('Atestado não encontrado.');

    // Se a imagem no DTO for diferente da salva, podemos tentar deletar a antiga
    if (dto.arquivoUrl && atestado.arquivoUrl && dto.arquivoUrl !== atestado.arquivoUrl) {
      try {
        await this.uploadService.deleteFile(atestado.arquivoUrl);
      } catch (e: any) {
        console.warn('Arquivo antigo não removido do Cloudinary:', e.message);
      }
    }

    const atestadoAtualizado = await this.prisma.atestado.update({
      where: { id },
      data: {
        ...(dto.motivo !== undefined ? { motivo: dto.motivo } : {}),
        ...(dto.arquivoUrl !== undefined ? { arquivoUrl: dto.arquivoUrl } : {}),
      },
      include: {
        frequencias: {
          select: {
            id: true,
            dataAula: true,
            status: true,
            turma: { select: { id: true, nome: true } },
          },
        },
      },
    });

    return atestadoAtualizado;
  }

  // ── Remover Atestado + Reverter Faltas (ADMIN) ─────────────────────────────
  async remover(id: string, role: Role) {
    if (role !== Role.ADMIN) {
      throw new ForbiddenException('Somente administradores podem remover atestados.');
    }

    const atestado = await this.prisma.atestado.findUnique({ where: { id } });
    if (!atestado) throw new NotFoundException('Atestado não encontrado.');

    // Reverte as faltas justificadas por este atestado de volta para FALTA
    const revertidas = await this.prisma.frequencia.updateMany({
      where: { justificativaId: id },
      data: {
        status: StatusFrequencia.FALTA,
        justificativaId: null,
      },
    });

    await this.prisma.atestado.delete({ where: { id } });

    return {
      mensagem: `Atestado removido. ${revertidas.count} falta(s) revertida(s) para FALTA.`,
    };
  }

  // ── Preview: quantas faltas serão justificadas ────────────────────────────
  async previewJustificativas(alunoId: string, dataInicio: string, dataFim: string) {
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);

    const faltas = await this.prisma.frequencia.findMany({
      where: {
        alunoId,
        dataAula: { gte: inicio, lte: fim },
        status: StatusFrequencia.FALTA,
      },
      select: {
        id: true,
        dataAula: true,
        turma: { select: { nome: true } },
      },
      orderBy: { dataAula: 'asc' },
    });

    return {
      totalFaltasNoperiodo: faltas.length,
      faltas,
    };
  }
}
