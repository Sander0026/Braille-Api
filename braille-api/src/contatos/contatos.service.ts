import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateContatoDto } from './dto/create-contato.dto';
import { PrismaService } from '../prisma/prisma.service';
import { QueryContatoDto } from './dto/query-contato.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAcao, Role } from '@prisma/client';

export interface AuditUserParams {
  sub: string;
  nome: string;
  role: string;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class ContatosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditLogService,
  ) { }

  private getAutorPadrao(auditUser?: AuditUserParams) {
    if (!auditUser) return {};
    return {
      autorId: auditUser.sub,
      autorNome: auditUser.nome,
      autorRole: auditUser.role as Role,
      ip: auditUser.ip,
      userAgent: auditUser.userAgent,
    };
  }

  async create(createContatoDto: CreateContatoDto) {
    return this.prisma.mensagemContato.create({ data: createContatoDto });
  }

  async findAll(query: QueryContatoDto) {
    const { page = 1, limit = 20, lida } = query;
    const skip = (page - 1) * limit;

    const whereCondicao: any = {};
    if (lida !== undefined) whereCondicao.lida = lida;

    const [mensagens, total] = await Promise.all([
      this.prisma.mensagemContato.findMany({
        where: whereCondicao,
        skip,
        take: limit,
        orderBy: { criadoEm: 'desc' },
      }),
      this.prisma.mensagemContato.count({ where: whereCondicao }),
    ]);

    return {
      data: mensagens,
      meta: { total, page, lastPage: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const mensagem = await this.prisma.mensagemContato.findUnique({ where: { id } });
    if (!mensagem) throw new NotFoundException('Mensagem não encontrada');
    return mensagem;
  }

  async marcarComoLida(id: string, auditUser?: AuditUserParams) {
    const mensagemAntiga = await this.findOne(id);
    
    // Evita loop no banco de dados se a mensagem já estava lida
    if (mensagemAntiga.lida) return mensagemAntiga;

    const mensagemAtualizada = await this.prisma.mensagemContato.update({
      where: { id },
      data: { lida: true },
    });

    this.auditService.registrar({
      entidade: 'Contato',
      registroId: id,
      acao: AuditAcao.MUDAR_STATUS,
      ...this.getAutorPadrao(auditUser),
      oldValue: { lida: false },
      newValue: { lida: true },
    });

    return mensagemAtualizada;
  }

  async remove(id: string, auditUser?: AuditUserParams) {
    const mensagemAntiga = await this.findOne(id);
    const result = await this.prisma.mensagemContato.delete({ where: { id } });

    this.auditService.registrar({
      entidade: 'Contato',
      registroId: id,
      acao: AuditAcao.EXCLUIR,
      ...this.getAutorPadrao(auditUser),
      oldValue: mensagemAntiga,
    });

    return result;
  }
}