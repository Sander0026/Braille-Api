import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { QueryUserDto } from './dto/query-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) { }

  async create(createUserDto: CreateUserDto) {
    const { nome, username, email, senha, role, fotoPerfil } = createUserDto;

    const userExists = await this.prisma.user.findUnique({ where: { username } });
    if (userExists) {
      throw new ConflictException('Este nome de usuário já está em uso.');
    }

    const hashedPassword = await bcrypt.hash(senha, 10);

    const user = await this.prisma.user.create({
      data: {
        nome,
        username,
        email,
        senha: hashedPassword,
        role,
        fotoPerfil,
      },
    });

    // Retorna o usuário sem a senha
    const { senha: _, ...result } = user;
    return result;
  }

  async findAll(query: QueryUserDto) {
    const { page = 1, limit = 10, nome } = query;
    const skip = (page - 1) * limit;

    const whereCondicao: any = { statusAtivo: true };
    if (nome) {
      whereCondicao.nome = { contains: nome, mode: 'insensitive' };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: whereCondicao,
        skip,
        take: limit,
        select: { id: true, nome: true, email: true, role: true, fotoPerfil: true },
        orderBy: { nome: 'asc' },
      }),
      this.prisma.user.count({ where: whereCondicao }),
    ]);

    return {
      data: users,
      meta: { total, page, lastPage: Math.ceil(total / limit) },
    };
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    if (updateUserDto.senha) {
      updateUserDto.senha = await bcrypt.hash(updateUserDto.senha, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...updateUserDto,
        role: updateUserDto.role as any,
      },
      select: { id: true, nome: true, email: true, role: true, atualizadoEm: true }
    });
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    return this.prisma.user.update({
      where: { id },
      data: { statusAtivo: false },
    });
  }
}