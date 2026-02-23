import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { UpdateBeneficiaryDto } from './dto/update-beneficiary.dto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class BeneficiariesService {
  
  async create(createBeneficiaryDto: CreateBeneficiaryDto) {
    const beneficiarioExiste = await prisma.aluno.findUnique({
      where: { cpfRg: createBeneficiaryDto.cpfRg }
    });

    if (beneficiarioExiste) {
      throw new ConflictException('Já existe um beneficiário cadastrado com este CPF/RG.');
    }

    const dadosParaSalvar = {
      ...createBeneficiaryDto,
      dataNascimento: new Date(createBeneficiaryDto.dataNascimento)
    };

    return prisma.aluno.create({
      data: dadosParaSalvar
    });
  }

  async findAll() {
    return prisma.aluno.findMany({
      where: { statusAtivo: true },
      orderBy: { nomeCompleto: 'asc' }
    });
  }

  async findOne(id: string) {
    const beneficiario = await prisma.aluno.findUnique({
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

    return prisma.aluno.update({
      where: { id },
      data: dadosParaAtualizar
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return prisma.aluno.update({
      where: { id },
      data: { statusAtivo: false }
    });
  }
}