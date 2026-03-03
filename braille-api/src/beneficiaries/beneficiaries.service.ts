import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { UpdateBeneficiaryDto } from './dto/update-beneficiary.dto';
import { PrismaService } from '../prisma/prisma.service';
import { QueryBeneficiaryDto } from './dto/query-beneficiary.dto';

@Injectable()
export class BeneficiariesService {
  constructor(private prisma: PrismaService) { }

  async create(createBeneficiaryDto: CreateBeneficiaryDto) {
    const beneficiarioExiste = await this.prisma.aluno.findUnique({
      where: { cpfRg: createBeneficiaryDto.cpfRg }
    });

    if (beneficiarioExiste) {
      throw new ConflictException('Já existe um beneficiário cadastrado com este CPF/RG.');
    }

    const dadosParaSalvar = {
      ...createBeneficiaryDto,
      dataNascimento: new Date(createBeneficiaryDto.dataNascimento)
    };

    return this.prisma.aluno.create({
      data: dadosParaSalvar
    });
  }

  async findAll(query: QueryBeneficiaryDto) {
    const { page = 1, limit = 10, nome, inativos } = query;
    const skip = (page - 1) * limit;

    const whereCondicao: any = {
      excluido: false,
    };

    if (inativos) {
      whereCondicao.statusAtivo = false;
    } else {
      whereCondicao.statusAtivo = true;
    }

    if (nome) {
      whereCondicao.nomeCompleto = { contains: nome, mode: 'insensitive' };
    }

    const [alunos, total] = await Promise.all([
      this.prisma.aluno.findMany({
        where: whereCondicao,
        skip,
        take: limit,
        select: {
          id: true,
          nomeCompleto: true,
          cpfRg: true,
          dataNascimento: true,
          telefoneContato: true,
          tipoDeficiencia: true,
          statusAtivo: true,
          criadoEm: true,
        },
        orderBy: { nomeCompleto: 'asc' },
      }),
      this.prisma.aluno.count({ where: whereCondicao }),
    ]);

    return {
      data: alunos,
      meta: { total, page, lastPage: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const beneficiario = await this.prisma.aluno.findUnique({
      where: { id },
      include: { matriculas: true }
    });

    if (!beneficiario) throw new NotFoundException('Beneficiário não encontrado.');
    return beneficiario;
  }

  async update(id: string, updateBeneficiaryDto: UpdateBeneficiaryDto) {
    await this.findOne(id);

    let dadosParaAtualizar: any = { ...updateBeneficiaryDto };

    if (updateBeneficiaryDto.dataNascimento) {
      dadosParaAtualizar.dataNascimento = new Date(updateBeneficiaryDto.dataNascimento);
    }

    return this.prisma.aluno.update({
      where: { id },
      data: dadosParaAtualizar
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.aluno.update({
      where: { id },
      data: { statusAtivo: false }
    });
  }

  async restore(id: string) {
    await this.findOne(id);
    return this.prisma.aluno.update({
      where: { id },
      data: { statusAtivo: true }
    });
  }

  async removeHard(id: string) {
    await this.findOne(id);
    return this.prisma.aluno.update({
      where: { id },
      data: { excluido: true }
    });
  }
}