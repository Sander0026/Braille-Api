import { Injectable, ConflictException } from '@nestjs/common';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class BeneficiariesService {
  async create(createBeneficiaryDto: CreateBeneficiaryDto) {
    // 1. Verifica se já existe alguém com esse CPF
    const alunoExiste = await prisma.aluno.findUnique({
      where: { cpf: createBeneficiaryDto.cpf },
    });

    if (alunoExiste) {
      throw new ConflictException('Já existe um aluno cadastrado com este CPF.');
    }

    // 2. Salva no banco de dados
    const novoAluno = await prisma.aluno.create({
      data: {
        nomeCompleto: createBeneficiaryDto.nomeCompleto,
        cpf: createBeneficiaryDto.cpf,
        dataNascimento: new Date(createBeneficiaryDto.dataNascimento),
        contatoEmergencia: createBeneficiaryDto.contatoEmergencia,
        tipoDeficiencia: createBeneficiaryDto.tipoDeficiencia,
        leBraille: createBeneficiaryDto.leBraille ?? false,
        usaCaoGuia: createBeneficiaryDto.usaCaoGuia ?? false,
      },
    });

    return novoAluno;
  }

  async findAll() {
    return prisma.aluno.findMany(); // Retorna todos os alunos do banco
  }
}