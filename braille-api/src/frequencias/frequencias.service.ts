import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { CreateFrequenciaDto } from './dto/create-frequencia.dto';
import { UpdateFrequenciaDto } from './dto/update-frequencia.dto';
import { PrismaService } from '../prisma/prisma.service';
import { QueryFrequenciaDto } from './dto/query-frequencia.dto';

@Injectable()
export class FrequenciasService {
  constructor(private prisma: PrismaService) { }

  async create(createFrequenciaDto: CreateFrequenciaDto) {
    const dataConvertida = new Date(createFrequenciaDto.dataAula);

    // Trava de Segurança: chamada já registrada para este aluno/turma/dia
    const chamadaExistente = await this.prisma.frequencia.findFirst({
      where: {
        alunoId: createFrequenciaDto.alunoId,
        turmaId: createFrequenciaDto.turmaId,
        dataAula: dataConvertida,
      },
    });

    if (chamadaExistente) {
      throw new ConflictException('A chamada para este aluno nesta oficina já foi registrada hoje.');
    }

    return this.prisma.frequencia.create({
      data: { ...createFrequenciaDto, dataAula: dataConvertida },
    });
  }

  async findAll(query: QueryFrequenciaDto) {
    const { page = 1, limit = 20, turmaId, alunoId, dataAula } = query;
    const skip = (page - 1) * limit;

    const whereCondicao: any = {};
    if (turmaId) whereCondicao.turmaId = turmaId;
    if (alunoId) whereCondicao.alunoId = alunoId;
    if (dataAula) whereCondicao.dataAula = new Date(dataAula);

    const [frequencias, total] = await Promise.all([
      this.prisma.frequencia.findMany({
        where: whereCondicao,
        skip,
        take: limit,
        include: {
          aluno: { select: { id: true, nomeCompleto: true } },
          turma: { select: { id: true, nome: true } },
        },
        orderBy: { dataAula: 'desc' },
      }),
      this.prisma.frequencia.count({ where: whereCondicao }),
    ]);

    return {
      data: frequencias,
      meta: { total, page, lastPage: Math.ceil(total / limit) },
    };
  }

  async findResumo(query: QueryFrequenciaDto) {
    const { page = 1, limit = 20, turmaId } = query;
    const skip = (page - 1) * limit;

    const whereCondicao: any = {};
    if (turmaId) whereCondicao.turmaId = turmaId;

    const grouped = await this.prisma.frequencia.groupBy({
      by: ['dataAula', 'turmaId'],
      where: whereCondicao,
      _count: { _all: true },
      orderBy: { dataAula: 'desc' },
    });

    const total = grouped.length;
    const paginatedGroup = grouped.slice(skip, skip + Number(limit));

    const enrichedData = await Promise.all(
      paginatedGroup.map(async (group) => {
        const turma = await this.prisma.turma.findUnique({
          where: { id: group.turmaId },
          select: { nome: true },
        });

        const presentesCount = await this.prisma.frequencia.count({
          where: {
            dataAula: group.dataAula,
            turmaId: group.turmaId,
            presente: true,
          },
        });

        return {
          dataAula: group.dataAula,
          turmaId: group.turmaId,
          turmaNome: turma?.nome || 'Desconhecido',
          totalAlunos: group._count._all,
          presentes: presentesCount,
          faltas: group._count._all - presentesCount,
        };
      })
    );

    return {
      data: enrichedData,
      meta: { total, page, lastPage: Math.ceil(total / limit) },
    };
  }

  async getRelatorioAluno(turmaId: string, alunoId: string) {
    const data = await this.prisma.frequencia.findMany({
      where: { turmaId, alunoId },
      orderBy: { dataAula: 'desc' },
    });

    const totais = data.reduce(
      (acc, curr) => {
        if (curr.presente) acc.presentes++;
        else acc.faltas++;
        return acc;
      },
      { presentes: 0, faltas: 0 }
    );

    return {
      estatisticas: {
        totalAulas: data.length,
        ...totais,
        taxaPresenca: data.length > 0 ? Math.round((totais.presentes / data.length) * 100) : 0,
      },
      historico: data,
    };
  }

  async findOne(id: string) {
    const frequencia = await this.prisma.frequencia.findUnique({
      where: { id },
      include: { aluno: true, turma: true },
    });
    if (!frequencia) throw new NotFoundException('Registro de chamada não encontrado.');
    return frequencia;
  }

  async update(id: string, updateFrequenciaDto: UpdateFrequenciaDto) {
    await this.findOne(id);
    const dadosParaAtualizar: any = { ...updateFrequenciaDto };
    if (updateFrequenciaDto.dataAula) {
      dadosParaAtualizar.dataAula = new Date(updateFrequenciaDto.dataAula);
    }
    return this.prisma.frequencia.update({ where: { id }, data: dadosParaAtualizar });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.frequencia.delete({ where: { id } });
  }
}