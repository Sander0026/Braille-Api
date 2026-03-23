import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateApoiadorDto, UpdateApoiadorDto } from './dto/apoiador.dto';
import { Prisma, TipoApoiador } from '@prisma/client';

@Injectable()
export class ApoiadoresService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createApoiadorDto: CreateApoiadorDto) {
    return this.prisma.apoiador.create({
      data: createApoiadorDto,
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
    // verifica a existencia para dar erro 404 antes
    await this.findOne(id);
    return this.prisma.apoiador.update({
      where: { id },
      data: updateApoiadorDto,
    });
  }

  async updateLogo(id: string, logoUrl: string) {
    await this.findOne(id);
    return this.prisma.apoiador.update({
      where: { id },
      data: { logoUrl },
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
