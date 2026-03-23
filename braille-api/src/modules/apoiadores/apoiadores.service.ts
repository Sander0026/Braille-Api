import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateApoiadorDto, UpdateApoiadorDto } from './dto/apoiador.dto';
import { Prisma, TipoApoiador } from '@prisma/client';

@Injectable()
export class ApoiadoresService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createApoiadorDto: CreateApoiadorDto) {
    const { acoes, ...rest } = createApoiadorDto;
    return this.prisma.apoiador.create({
      data: {
        ...rest,
        acoes: acoes && acoes.length > 0 ? { create: acoes } : undefined,
      },
    });
  }

  async findAll(params: { skip?: number; take?: number; tipo?: TipoApoiador; search?: string }) {
    const { skip, take, tipo, search } = params;
    const where: Prisma.ApoiadorWhereInput = {};

    if (tipo) {
      where.tipo = tipo;
    }

    if (search) {
      where.OR = [
        { nomeRazaoSocial: { contains: search, mode: 'insensitive' } },
        { nomeFantasia: { contains: search, mode: 'insensitive' } },
        { atividadeEspecialidade: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [apoiadores, total] = await Promise.all([
      this.prisma.apoiador.findMany({
        skip,
        take,
        where,
        orderBy: { criadoEm: 'desc' },
      }),
      this.prisma.apoiador.count({ where }),
    ]);

    return { total, data: apoiadores };
  }

  async findPublic() {
    return this.prisma.apoiador.findMany({
      where: {
        ativo: true,
        exibirNoSite: true,
      },
      orderBy: { nomeRazaoSocial: 'asc' },
    });
  }

  async findOne(id: string) {
    const apoiador = await this.prisma.apoiador.findUnique({
      where: { id },
    });
    if (!apoiador) {
      throw new NotFoundException(`Apoiador com ID ${id} não encontrado`);
    }
    return apoiador;
  }

  async update(id: string, updateApoiadorDto: UpdateApoiadorDto) {
    const { acoes, ...rest } = updateApoiadorDto;
    await this.findOne(id);
    return this.prisma.apoiador.update({
      where: { id },
      data: rest,
    });
  }

  async updateLogo(id: string, logoUrl: string) {
    await this.findOne(id);
    return this.prisma.apoiador.update({
      where: { id },
      data: { logoUrl },
    });
  }

  // ---- Histórico de Ações (Tracking Relacional) ----
  
  async addAcao(apoiadorId: string, dataEvento: Date, descricaoAcao: string) {
    await this.findOne(apoiadorId); // garante existencia
    return this.prisma.acaoApoiador.create({
      data: {
        dataEvento: new Date(dataEvento), // Força a deserialização da string vinda do POST
        descricaoAcao,
        apoiadorId,
      },
    });
  }
  
  async getAcoes(apoiadorId: string) {
    await this.findOne(apoiadorId);
    return this.prisma.acaoApoiador.findMany({
      where: { apoiadorId },
      orderBy: { dataEvento: 'desc' },
    });
  }

  async removeAcao(apoiadorId: string, acaoId: string) {
    const acao = await this.prisma.acaoApoiador.findFirst({
      where: { id: acaoId, apoiadorId },
    });
    if (!acao) throw new NotFoundException('Ação não encontrada nesse perfil.');
    return this.prisma.acaoApoiador.delete({
      where: { id: acaoId },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    // Em CRM, costuma ser recomendado apenas o soft-delete. 
    // Como a instrução não obrigou exclusão real profunda:
    return this.prisma.apoiador.update({
      where: { id },
      data: { ativo: false },
    });
  }
}
