import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { CreateFrequenciaDto } from './dto/create-frequencia.dto';
import { UpdateFrequenciaDto } from './dto/update-frequencia.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FrequenciasService {
  constructor(private prisma: PrismaService) { }

  async create(createFrequenciaDto: CreateFrequenciaDto) {
    // 1. Converte a data enviada pelo frontend
    const dataConvertida = new Date(createFrequenciaDto.dataAula);

    // 2. Trava de Segurança: Verifica se a chamada já foi feita hoje para este aluno nesta turma
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

    // 3. Salva no banco de dados
    return this.prisma.frequencia.create({
      data: {
        ...createFrequenciaDto,
        dataAula: dataConvertida,
      },
    });
  }

  async findAll() {
    return this.prisma.frequencia.findMany({
      include: {
        aluno: { select: { nomeCompleto: true } },
        turma: { select: { nome: true } }
      },
      orderBy: { dataAula: 'desc' }
    });
  }

  async findOne(id: string) {
    const frequencia = await this.prisma.frequencia.findUnique({
      where: { id },
      include: { aluno: true, turma: true }
    });

    if (!frequencia) throw new NotFoundException('Registro de chamada não encontrado.');
    return frequencia;
  }

  async update(id: string, updateFrequenciaDto: UpdateFrequenciaDto) {
    await this.findOne(id);

    let dadosParaAtualizar: any = { ...updateFrequenciaDto };

    if (updateFrequenciaDto.dataAula) {
      dadosParaAtualizar.dataAula = new Date(updateFrequenciaDto.dataAula);
    }

    return this.prisma.frequencia.update({
      where: { id },
      data: dadosParaAtualizar
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.frequencia.delete({ where: { id } });
  }
}