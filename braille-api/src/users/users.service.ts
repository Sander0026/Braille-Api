import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

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

  async findAll() {
    return prisma.user.findMany({
      select: { id: true, nome: true, email: true, role: true }
    });
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

    return prisma.user.delete({
      where: { id },
    });
  }
}