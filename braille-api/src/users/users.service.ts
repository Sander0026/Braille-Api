import { Injectable, ConflictException, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { QueryUserDto } from './dto/query-user.dto';
import { gerarMatriculaStaff } from '../common/helpers/matricula.helper';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAcao, Role } from '@prisma/client';
import { REQUEST } from '@nestjs/core';
import { UploadService } from '../upload/upload.service';

// Senha padrão definida pela instituição (deve ser trocada no primeiro login)
const SENHA_PADRAO = 'Ilbes@123';

/**
 * Gera um username único no formato: primeiroNome.ultimoSobrenome + número (se colisão).
 * Ex: "joao.silva" ou "joao.silva2"
 */
async function gerarUsername(nome: string, prisma: PrismaService): Promise<string> {
  const partes = nome.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/);
  const primeiro = partes[0].replace(/[^a-z0-9]/g, '');
  const ultimo = partes.length > 1 ? partes[partes.length - 1].replace(/[^a-z0-9]/g, '') : '';
  const base = ultimo ? `${primeiro}.${ultimo}` : primeiro;

  let username = base;
  let tentativa = 2;

  while (await prisma.user.findFirst({ where: { username } })) {
    username = `${base}${tentativa}`;
    tentativa++;
  }

  return username;
}

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditLogService,
    private uploadService: UploadService,
    @Inject(REQUEST) private request: any,
  ) { }

  private getAutor() {
    return {
      autorId: this.request.user?.sub,
      autorNome: this.request.user?.nome,
      autorRole: this.request.user?.role as Role,
      ip: (this.request.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() || this.request.socket?.remoteAddress,
      userAgent: this.request.headers?.['user-agent'],
    };
  }

  async create(createUserDto: CreateUserDto) {
    const { nome, cpf, email, role, telefone, cep, rua, numero, complemento, bairro, cidade, uf } = createUserDto;

    // 1. Verificar se CPF já existe
    const userByCpf = await this.prisma.user.findUnique({ where: { cpf } });

    if (userByCpf) {
      if (!userByCpf.excluido && userByCpf.statusAtivo) {
        throw new ConflictException('Já existe um funcionário ativo com este CPF.');
      }
      // CPF inativo/excluído — retorna sinal de reativação
      return {
        _reativacao: true,
        id: userByCpf.id,
        nome: userByCpf.nome,
        username: userByCpf.username,
        statusAtivo: userByCpf.statusAtivo,
        excluido: userByCpf.excluido,
        message: 'Funcionário inativo encontrado com este CPF.',
      };
    }

    // 2. Gerar username único automaticamente
    const username = await gerarUsername(nome, this.prisma);

    // 3. Gerar matrícula institucional
    const matricula = await gerarMatriculaStaff(this.prisma);

    // 4. Usar senha padrão (deve ser trocada no primeiro login)
    const hashedPassword = await bcrypt.hash(SENHA_PADRAO, 10);

    // 5. Criar o usuário
    const user = await this.prisma.user.create({
      data: {
        nome, username, email, cpf, matricula, role,
        senha: hashedPassword,
        precisaTrocarSenha: true,
        telefone, cep, rua, numero, complemento, bairro, cidade, uf,
      },
    });

    // Retorna o usuário sem a senha, mas com as credenciais geradas para o Admin anotar
    const { senha: _, ...result } = user;

    // Toca a auditoria (Fire and Forget)
    this.auditService.registrar({
      entidade: 'User',
      registroId: user.id,
      acao: AuditAcao.CRIAR,
      ...this.getAutor(),
      // Como não temos a requisição HTTP completa aqui, salvamos o mínimo possível ou passamos autor via payload futuramente
      newValue: result,
    });

    return {
      ...result,
      _credenciais: {
        username,
        senha: SENHA_PADRAO,
        instrucao: 'Entregue estas credenciais ao funcionário. A senha deve ser trocada no primeiro login.',
      },
    };
  }

  async reativar(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    // Gera nova senha padrão ao reativar
    const hashedPassword = await bcrypt.hash(SENHA_PADRAO, 10);

    const reativado = await this.prisma.user.update({
      where: { id },
      data: {
        statusAtivo: true,
        excluido: false,
        senha: hashedPassword,
        precisaTrocarSenha: true,
      },
      select: { id: true, nome: true, username: true, email: true, role: true, matricula: true },
    });

    this.auditService.registrar({
      entidade: 'User',
      registroId: id,
      acao: AuditAcao.RESTAURAR,
      ...this.getAutor(),
      oldValue: { statusAtivo: user.statusAtivo, excluido: user.excluido, precisaTrocarSenha: user.precisaTrocarSenha },
      newValue: { statusAtivo: true, excluido: false, precisaTrocarSenha: true, mensagem: 'Senha resetada e usuário reativado.' },
    });

    return {
      ...reativado,
      _credenciais: {
        username: reativado.username,
        senha: SENHA_PADRAO,
        instrucao: 'Funcionário reativado. Entregue as credenciais ao funcionário para o primeiro login.',
      },
    };
  }

  async findAll(query: QueryUserDto) {
    const { page = 1, limit = 10, nome, inativos, role } = query;
    const skip = (page - 1) * limit;

    const whereCondicao: any = {
      statusAtivo: !inativos,
      excluido: false,
    };

    if (nome) {
      whereCondicao.nome = { contains: nome, mode: 'insensitive' };
    }
    
    if (role) {
      whereCondicao.role = role;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: whereCondicao,
        skip,
        take: limit,
        select: {
          id: true, nome: true, username: true, email: true, role: true,
          fotoPerfil: true, precisaTrocarSenha: true, matricula: true,
          cpf: true, telefone: true, cidade: true, uf: true,
        },
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

    // Se a foto de perfil for atualizada, deleta o arquivo antigo do Cloudinary
    if (updateUserDto.fotoPerfil !== undefined && user.fotoPerfil && updateUserDto.fotoPerfil !== user.fotoPerfil) {
      try {
        await this.uploadService.deleteFile(user.fotoPerfil);
      } catch (e: any) {
        console.warn('Foto de perfil antiga não removida do Cloudinary:', e.message);
      }
    }

    if (updateUserDto.senha) {
      updateUserDto.senha = await bcrypt.hash(updateUserDto.senha, 10);
    }

    const userAtualizado = await this.prisma.user.update({
      where: { id },
      data: { ...updateUserDto, role: updateUserDto.role as any },
      select: {
        id: true, nome: true, username: true, email: true, role: true,
        fotoPerfil: true, matricula: true, cpf: true,
        telefone: true, cep: true, rua: true, numero: true,
        complemento: true, bairro: true, cidade: true, uf: true, atualizadoEm: true,
      },
    });

    this.auditService.registrar({
      entidade: 'User',
      registroId: id,
      acao: AuditAcao.ATUALIZAR,
      ...this.getAutor(),
      oldValue: Object.fromEntries(Object.entries(user).filter(([k]) => k !== 'senha')),
      newValue: userAtualizado,
    });

    return userAtualizado;
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    // Impedir auto-exclusão: um admin não pode desativar a si mesmo
    const autorId = this.request.user?.sub;
    if (autorId && autorId === id) {
      throw new BadRequestException('Não é possível desativar o usuário que está logado.');
    }

    const result = await this.prisma.user.update({ where: { id }, data: { statusAtivo: false } });

    this.auditService.registrar({
      entidade: 'User',
      registroId: id,
      acao: AuditAcao.MUDAR_STATUS,
      ...this.getAutor(),
      oldValue: { statusAtivo: true },
      newValue: { statusAtivo: false },
    });

    return result;
  }

  async restore(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    const result = await this.prisma.user.update({ where: { id }, data: { statusAtivo: true } });

    this.auditService.registrar({
      entidade: 'User',
      registroId: id,
      acao: AuditAcao.RESTAURAR,
      ...this.getAutor(),
      oldValue: { statusAtivo: false },
      newValue: { statusAtivo: true },
    });

    return result;
  }

  async resetPassword(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    const defaultPasswordHashed = await bcrypt.hash(SENHA_PADRAO, 10);
    const result = await this.prisma.user.update({
      where: { id },
      data: { senha: defaultPasswordHashed, precisaTrocarSenha: true },
      select: { id: true, nome: true, email: true, role: true, atualizadoEm: true },
    });

    this.auditService.registrar({
      entidade: 'User',
      registroId: id,
      acao: AuditAcao.ATUALIZAR,
      ...this.getAutor(),
      oldValue: { precisaTrocarSenha: user.precisaTrocarSenha },
      newValue: { precisaTrocarSenha: true, mensagem: 'Senha resetada pelo administrador com senha padrão.' },
    });

    return result;
  }

  async removeHard(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    // Impedir auto-exclusão permanente
    const autorId = this.request.user?.sub;
    if (autorId && autorId === id) {
      throw new BadRequestException('Não é possível excluir o usuário que está logado.');
    }

    const result = await this.prisma.user.update({ where: { id }, data: { excluido: true } });

    this.auditService.registrar({
      entidade: 'User',
      registroId: id,
      acao: AuditAcao.ARQUIVAR,
      ...this.getAutor(),
      oldValue: { excluido: false },
      newValue: { excluido: true },
    });

    return result;
  }
}