import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { QueryUserDto } from './dto/rc/users/dto/query-user.dto';


const prisma = new PrismaClient();

@Injectable()
export class UsersService {
  async create(createUserDto: CreateUserDto) {
    const emailExiste = await prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (emailExiste) {
      throw new ConflictException('Este e-mail já está cadastrado.');
    }

    const senhaCriptografada = await bcrypt.hash(createUserDto.senha, 10);

    return prisma.user.create({
      data: {
        nome: createUserDto.nome,
        email: createUserDto.email,
        senha: senhaCriptografada,
        // 👇 Dizemos ao TypeScript para ignorar a tipagem estrita aqui
        role: createUserDto.role as any, 
      },
      select: { id: true, nome: true, email: true, role: true, createdAt: true }
    });
  }

  async findAll(query: QueryUserDto) {
    const { page = 1, limit = 10, nome } = query;
    const skip = (page - 1) * limit;

    // 👇 Agora só busca usuários ATIVOS
    const whereCondicao: any = { statusAtivo: true }; 
    if (nome) {
      whereCondicao.nome = { contains: nome, mode: 'insensitive' };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereCondicao,
        skip,
        take: limit,
        select: { id: true, nome: true, email: true, role: true, fotoPerfil: true },
        orderBy: { nome: 'asc' },
      }),
      prisma.user.count({ where: whereCondicao }),
    ]);

    return {
      data: users,
      meta: { total, page, lastPage: Math.ceil(total / limit) },
    };
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    if (updateUserDto.senha) {
      updateUserDto.senha = await bcrypt.hash(updateUserDto.senha, 10);
    }

    return prisma.user.update({
      where: { id },
      // 👇 Desempacotamos o DTO e forçamos o tipo do role
      data: {
        ...updateUserDto,
        role: updateUserDto.role as any,
      },
      select: { id: true, nome: true, email: true, role: true, updatedAt: true }
    });
  }

  async remove(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    // 👇 Muda de prisma.user.delete para prisma.user.update
    return prisma.user.update({
      where: { id },
      data: { statusAtivo: false }, // Faz o Soft Delete
    });
  }
}