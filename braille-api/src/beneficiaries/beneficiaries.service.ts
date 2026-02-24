import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { UpdateBeneficiaryDto } from './dto/update-beneficiary.dto';
import { PrismaService } from '../prisma/prisma.service';

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

  async findAll() {
    return this.prisma.aluno.findMany({
      where: { statusAtivo: true },
      orderBy: { nomeCompleto: 'asc' }
    });
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
}