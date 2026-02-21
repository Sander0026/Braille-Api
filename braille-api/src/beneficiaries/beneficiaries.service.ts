import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { UpdateBeneficiaryDto } from './dto/update-beneficiary.dto';
import { PrismaClient } from '@prisma/client';
import { QueryBeneficiaryDto } from './dto/query-beneficiary.dto';

// 👇 O Prisma v5 resolve tudo sozinho apenas com os parênteses vazios!
const prisma = new PrismaClient();

@Injectable()
export class BeneficiariesService {
  async create(createBeneficiaryDto: CreateBeneficiaryDto) {
    const alunoExiste = await prisma.aluno.findUnique({
      where: { cpf: createBeneficiaryDto.cpf },
    });

    if (alunoExiste) {
      throw new ConflictException('Já existe um aluno cadastrado com este CPF.');
    }

    return prisma.aluno.create({
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
  }

  async findAll(query: QueryBeneficiaryDto) {
    // 1. Pega os valores da URL (ou usa os padrões 1 e 10)
    const { page = 1, limit = 10, nome } = query;
    
    // 2. Calcula quantos registros pular (ex: página 2 pula os 10 primeiros)
    const skip = (page - 1) * limit;

    // 3. Monta o filtro: Só traz os ativos. Se mandou nome, busca no nomeCompleto ignorando maiúsculas/minúsculas.
    const whereCondicao: any = { statusAtivo: true };
    if (nome) {
      whereCondicao.nomeCompleto = { contains: nome, mode: 'insensitive' };
    }

    // 4. Executa duas buscas simultâneas no banco (os alunos da página + o total geral)
    const [alunos, total] = await Promise.all([
      prisma.aluno.findMany({
        where: whereCondicao,
        skip,
        take: limit,
        orderBy: { nomeCompleto: 'asc' }, // Ordena por ordem alfabética!
      }),
      prisma.aluno.count({ where: whereCondicao }),
    ]);

    // 5. Devolve os dados formatados para o Frontend
    return {
      data: alunos,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit), // Calcula o total de páginas
      },
    };
  }

  async update(id: string, updateBeneficiaryDto: UpdateBeneficiaryDto) {
    // 1. Verifica se o aluno existe
    const aluno = await prisma.aluno.findUnique({ where: { id } });
    if (!aluno) throw new NotFoundException('Aluno não encontrado.');

    // 2. Se a secretaria enviou um CPF novo, verifica se ele já pertence a OUTRO aluno
    if (updateBeneficiaryDto.cpf && updateBeneficiaryDto.cpf !== aluno.cpf) {
      const cpfJaExiste = await prisma.aluno.findUnique({
        where: { cpf: updateBeneficiaryDto.cpf },
      });
      
      if (cpfJaExiste) {
        throw new ConflictException('Este CPF já está cadastrado para outro aluno.');
      }
    }

    // 3. Tudo certo, pode atualizar!
    return prisma.aluno.update({
      where: { id },
      data: updateBeneficiaryDto,
    });
  }

  async remove(id: string) {
    const aluno = await prisma.aluno.findUnique({ where: { id } });
    if (!aluno) throw new NotFoundException('Aluno não encontrado.');

    // Soft Delete: Apenas muda o status para false em vez de apagar do banco
    return prisma.aluno.update({
      where: { id },
      data: { statusAtivo: false },
    });
  }
}