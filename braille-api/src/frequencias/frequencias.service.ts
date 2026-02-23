import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { CreateFrequenciaDto } from './dto/create-frequencia.dto';
import { UpdateFrequenciaDto } from './dto/update-frequencia.dto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class FrequenciasService {
  
  async create(createFrequenciaDto: CreateFrequenciaDto) {
    // 1. Converte a data enviada pelo frontend
    const dataConvertida = new Date(createFrequenciaDto.dataAula);

    // 2. Trava de Segurança: Verifica se a chamada já foi feita hoje para este aluno nesta turma
    const chamadaExistente = await prisma.frequencia.findFirst({
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
    return prisma.frequencia.create({
      data: {
        ...createFrequenciaDto,
        dataAula: dataConvertida,
      },
    });
  }

  async findAll() {
    return prisma.frequencia.findMany({
      include: {
        aluno: { select: { nomeCompleto: true } }, // Traz o nome do aluno junto
        turma: { select: { nome: true } }          // Traz o nome da oficina junto
      },
      orderBy: { dataAula: 'desc' } // Mostra as chamadas mais recentes primeiro
    });
  }

  async findOne(id: string) {
    const frequencia = await prisma.frequencia.findUnique({
      where: { id },
      include: { aluno: true, turma: true }
    });

    if (!frequencia) throw new NotFoundException('Registro de chamada não encontrado.');
    return frequencia;
  }

  async update(id: string, updateFrequenciaDto: UpdateFrequenciaDto) {
    await this.findOne(id); // Verifica se existe antes de atualizar

    let dadosParaAtualizar: any = { ...updateFrequenciaDto };
    
    if (updateFrequenciaDto.dataAula) {
      dadosParaAtualizar.dataAula = new Date(updateFrequenciaDto.dataAula);
    }

    return prisma.frequencia.update({
      where: { id },
      data: dadosParaAtualizar
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return prisma.frequencia.delete({ where: { id } }); // Apaga o registro
  }
}