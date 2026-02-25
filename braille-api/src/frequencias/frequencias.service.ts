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