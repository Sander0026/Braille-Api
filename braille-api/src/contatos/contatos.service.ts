import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, AuditAcao } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditUser } from '../common/interfaces/audit-user.interface';
import { CreateContatoDto } from './dto/create-contato.dto';
import { QueryContatoDto } from './dto/query-contato.dto';

// ── Projeções Prisma ──────────────────────────────────────────────────────────

/**
 * Campos retornados na listagem — omite `mensagem` (texto longo) para reduzir
 * o volume de dados transferido em queries de paginação.
 */
const SELECT_LISTA = {
  id: true,
  nome: true,
  email: true,
  telefone: true,
  assunto: true,
  lida: true,
  criadoEm: true,
} satisfies Prisma.MensagemContatoSelect;

/** Campos retornados na visualização completa de uma mensagem. */
const SELECT_DETALHE = {
  ...SELECT_LISTA,
  mensagem: true,
} satisfies Prisma.MensagemContatoSelect;

/** Projeção mínima para o snapshot de auditoria de exclusão. */
const SELECT_AUDIT_SNAPSHOT = {
  id: true,
  nome: true,
  assunto: true,
  lida: true,
  criadoEm: true,
} satisfies Prisma.MensagemContatoSelect;

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class ContatosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditLogService,
  ) {}

  // ── Mutações ─────────────────────────────────────────────────────────────────

  async create(dto: CreateContatoDto) {
    return this.prisma.mensagemContato.create({
      data: dto,
      select: SELECT_DETALHE,
    });
  }

  async marcarComoLida(id: string, auditUser: AuditUser) {
    const mensagem = await this.findOne(id);

    // Cláusula de guarda: operação idempotente — evita write desnecessário
    if (mensagem.lida) return mensagem;

    const atualizada = await this.prisma.mensagemContato.update({
      where: { id },
      data: { lida: true },
      select: { id: true, lida: true },
    });

    // Fire-and-forget — falha de auditoria nunca interrompe o fluxo principal
    void this.auditService.registrar({
      entidade: 'Contato',
      registroId: id,
      acao: AuditAcao.MUDAR_STATUS,
      ...auditUser,
      oldValue: { lida: false },
      newValue: { lida: true },
    });

    return atualizada;
  }

  async remove(id: string, auditUser: AuditUser) {
    const snapshot = await this.prisma.mensagemContato.findUnique({
      where: { id },
      select: SELECT_AUDIT_SNAPSHOT,
    });

    if (!snapshot) throw new NotFoundException('Mensagem não encontrada');

    const resultado = await this.prisma.mensagemContato.delete({
      where: { id },
      select: SELECT_AUDIT_SNAPSHOT,
    });

    void this.auditService.registrar({
      entidade: 'Contato',
      registroId: id,
      acao: AuditAcao.EXCLUIR,
      ...auditUser,
      oldValue: snapshot,
    });

    return resultado;
  }

  // ── Consultas ─────────────────────────────────────────────────────────────────

  async findAll(query: QueryContatoDto) {
    const { page = 1, limit = 20, lida } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.MensagemContatoWhereInput = {
      ...(lida !== undefined && { lida }),
    };

    const [mensagens, total] = await Promise.all([
      this.prisma.mensagemContato.findMany({
        where,
        select: SELECT_LISTA,
        skip,
        take: limit,
        orderBy: { criadoEm: 'desc' },
      }),
      this.prisma.mensagemContato.count({ where }),
    ]);

    return {
      data: mensagens,
      meta: {
        total,
        page,
        limit,
        lastPage: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const mensagem = await this.prisma.mensagemContato.findUnique({
      where: { id },
      select: SELECT_DETALHE,
    });

    if (!mensagem) throw new NotFoundException('Mensagem não encontrada');

    return mensagem;
  }
}
