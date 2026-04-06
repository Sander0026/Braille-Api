import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAtestadoDto } from './dto/create-atestado.dto';
import { UpdateAtestadoDto } from './dto/update-atestado.dto';
import { Role, StatusFrequencia } from '@prisma/client';
import { UploadService } from '../upload/upload.service';
import { ApiResponse } from '../common/dto/api-response.dto';

@Injectable()
export class AtestadosService {
  private readonly logger = new Logger(AtestadosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) {}

  /**
   * Registra um novo atestado e justifica automaticamente as faltas do aluno naquele período.
   * @param alunoId ID do aluno associado
   * @param dto Dados validados do atestado
   * @param autorId ID do usuário que registrou a operação
   */
  async criar(alunoId: string, dto: CreateAtestadoDto, autorId: string): Promise<ApiResponse<any>> {
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
        registradoPorId: autorId,
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

    return new ApiResponse(true, {
      atestado,
      faltasJustificadas: resultado.count,
    }, `Atestado registrado. ${resultado.count} falta(s) justificada(s) automaticamente.`);
  }

  /**
   * Retorna a lista completa de atestados de um aluno com o histórico de frequências vinculadas.
   */
  async listarPorAluno(alunoId: string): Promise<ApiResponse<any>> {
    const aluno = await this.prisma.aluno.findUnique({ where: { id: alunoId } });
    if (!aluno) throw new NotFoundException('Aluno não encontrado.');

    const atestados = await this.prisma.atestado.findMany({
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
    
    return new ApiResponse(true, atestados);
  }

  /**
   * Recupera o detalhe completo de um atestado via ID.
   */
  async findOne(id: string): Promise<ApiResponse<any>> {
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
    return new ApiResponse(true, atestado);
  }

  /**
   * Atualiza as informações permitidas de um atestado (Motivo e/ou Arquivo comprobatório).
   */
  async atualizar(id: string, dto: UpdateAtestadoDto): Promise<ApiResponse<any>> {
    const atestado = await this.prisma.atestado.findUnique({ where: { id } });
    if (!atestado) throw new NotFoundException('Atestado não encontrado.');

    if (dto.arquivoUrl && atestado.arquivoUrl && dto.arquivoUrl !== atestado.arquivoUrl) {
      try {
        await this.uploadService.deleteFile(atestado.arquivoUrl);
      } catch (e: unknown) {
        const erroMsg = e instanceof Error ? e.message : 'Erro desconhecido';
        this.logger.warn(`Arquivo antigo não removido do Cloudinary: ${erroMsg}`);
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

    return new ApiResponse(true, atestadoAtualizado, 'Atestado atualizado com sucesso.');
  }

  /**
   * Remove um atestado fisicamente e desfaz as justificativas aplicadas, 
   * retornando os registros de frequência para FALTA. Restrito a ADMIN/SECRETARIA.
   */
  async remover(id: string, role: Role): Promise<ApiResponse<any>> {
    if (role !== Role.ADMIN && role !== Role.SECRETARIA) {
      throw new ForbiddenException('Somente administradores e secretarias podem remover atestados.');
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

    return new ApiResponse(true, {
      id,
      revertidas: revertidas.count
    }, `Atestado removido. ${revertidas.count} falta(s) revertida(s) para FALTA.`);
  }

  /**
   * Simula a quantidade de faltas que serão transformadas em justificadas pelo atestado.
   */
  async previewJustificativas(alunoId: string, dataInicio: string, dataFim: string): Promise<ApiResponse<any>> {
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

    return new ApiResponse(true, {
      totalFaltasNoperiodo: faltas.length,
      faltas,
    });
  }
}
