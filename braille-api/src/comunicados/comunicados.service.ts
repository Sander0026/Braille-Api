import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { CreateComunicadoDto } from './dto/create-comunicado.dto';
import { UpdateComunicadoDto } from './dto/update-comunicado.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { UploadService } from '../upload/upload.service';
import { AuditAcao, Role } from '@prisma/client';

export interface AuditUserParams {
  sub: string;
  nome: string;
  role: string;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class ComunicadosService {
  private readonly logger = new Logger(ComunicadosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditLogService,
    private readonly uploadService: UploadService,
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

  async create(createComunicadoDto: CreateComunicadoDto, auditUser?: AuditUserParams) {
    // Se não houver autor detectado no auditUser, exigiremos pelo menos achar um admin pra fallback
    let autorRealId = auditUser?.sub;

    if (!autorRealId) {
      const admin = await this.prisma.user.findFirst({ where: { username: 'admin' } });
      if (!admin) {
        throw new NotFoundException('Nenhum autor autenticado e Administrador principal não encontrado para assinar o comunicado.');
      }
      autorRealId = admin.id;
    }

    const comunicadoNovo = await this.prisma.comunicado.create({
      data: {
        titulo: createComunicadoDto.titulo,
        conteudo: createComunicadoDto.conteudo,
        categoria: createComunicadoDto.categoria,
        fixado: createComunicadoDto.fixado || false,
        autorId: autorRealId,
        imagemCapa: createComunicadoDto.imagemCapa,
      },
    });

    this.auditService.registrar({
      entidade: 'Comunicado',
      registroId: comunicadoNovo.id,
      acao: AuditAcao.CRIAR,
      ...this.getAutorPadrao(auditUser),
      newValue: comunicadoNovo,
    });

    return comunicadoNovo;
  }

  async findAll(query: import('./dto/query-comunicado.dto').QueryComunicadoDto = {}) {
    const { page = 1, limit = 10, titulo, categoria } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (titulo) {
      where.titulo = { contains: titulo, mode: 'insensitive' };
    }
    if (categoria) {
      where.categoria = categoria; // Enum CategoriaComunicado
    }

    const [data, total] = await Promise.all([
      this.prisma.comunicado.findMany({
        where,
        skip,
        take: limit,
        include: { autor: { select: { nome: true } } },
        orderBy: [
          { fixado: 'desc' },
          { criadoEm: 'desc' },
        ],
      }),
      this.prisma.comunicado.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const comunicado = await this.prisma.comunicado.findUnique({
      where: { id },
      include: { autor: { select: { nome: true } } }
    });

    if (!comunicado) throw new NotFoundException('Comunicado não encontrado.');
    return comunicado;
  }

  async update(id: string, updateComunicadoDto: UpdateComunicadoDto, auditUser?: AuditUserParams) {
    const comunicadoAntigo = await this.findOne(id);

    const comunicadoAtualizado = await this.prisma.comunicado.update({
      where: { id },
      data: {
        titulo: updateComunicadoDto.titulo,
        conteudo: updateComunicadoDto.conteudo,
        categoria: updateComunicadoDto.categoria,
        fixado: updateComunicadoDto.fixado,
        imagemCapa: updateComunicadoDto.imagemCapa,
      }
    });

    if (comunicadoAntigo.imagemCapa &&
        updateComunicadoDto.imagemCapa !== undefined &&
        comunicadoAntigo.imagemCapa !== updateComunicadoDto.imagemCapa) {
      try {
        await this.uploadService.deleteFile(comunicadoAntigo.imagemCapa);
      } catch (e: unknown) {
        this.logger.warn(`Falha não obstrutiva do Cloudinary ao deletar imagem de capa antiga do comunicado: ${(e as Error).message}`);
      }
    }

    this.auditService.registrar({
      entidade: 'Comunicado',
      registroId: id,
      acao: AuditAcao.ATUALIZAR,
      ...this.getAutorPadrao(auditUser),
      oldValue: Object.fromEntries(Object.entries(comunicadoAntigo).filter(([k]) => k !== 'autor')), // Remove nested
      newValue: comunicadoAtualizado,
    });

    return comunicadoAtualizado;
  }

  async remove(id: string, auditUser?: AuditUserParams) {
    const comunicado = await this.findOne(id);
    const result = await this.prisma.comunicado.delete({ where: { id } });

    if (comunicado.imagemCapa) {
      try {
        await this.uploadService.deleteFile(comunicado.imagemCapa);
      } catch (e: unknown) {
        this.logger.warn(`Falha isolada do Cloudinary ao deletar capa do comunicado excluído: ${(e as Error).message}`);
      }
    }

    this.auditService.registrar({
      entidade: 'Comunicado',
      registroId: id,
      acao: AuditAcao.EXCLUIR,
      ...this.getAutorPadrao(auditUser),
      oldValue: Object.fromEntries(Object.entries(comunicado).filter(([k]) => k !== 'autor')),
    });

    return result;
  }
}