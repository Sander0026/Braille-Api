import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma, AuditAcao } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { UploadService } from '../upload/upload.service';
import { AuditUser } from '../common/interfaces/audit-user.interface';
import { CreateComunicadoDto } from './dto/create-comunicado.dto';
import { UpdateComunicadoDto } from './dto/update-comunicado.dto';
import { QueryComunicadoDto } from './dto/query-comunicado.dto';

// ── Select cirúrgico — única fonte de verdade para os campos retornados ────────
//
// Centralizar aqui garante que findAll() e findOne() nunca divergem nos campos
// e que campos internos desnecessários não transitam na memória.
// Espelha o tipo ComunicadoResponse em entities/comunicado.entity.ts.
const COMUNICADO_SELECT = {
  id:           true,
  titulo:       true,
  conteudo:     true,
  categoria:    true,
  fixado:       true,
  imagemCapa:   true,
  autorId:      true,
  criadoEm:     true,
  atualizadoEm: true,
  autor: { select: { nome: true } },
} satisfies Prisma.ComunicadoSelect;

// ── Helper puro — remove relações aninhadas do snapshot de auditoria ──────────
// Evita a duplicação que existia em update() e remove() (violação DRY).
function omitAutor<T extends { autor?: unknown }>(obj: T): Omit<T, 'autor'> {
  const { autor: _ignored, ...rest } = obj;
  return rest as Omit<T, 'autor'>;
}

@Injectable()
export class ComunicadosService {
  private readonly logger = new Logger(ComunicadosService.name);

  constructor(
    private readonly prisma:         PrismaService,
    private readonly auditService:   AuditLogService,
    private readonly uploadService:  UploadService,
  ) {}

  // ── Mapeamento AuditUser → campos esperados pelo AuditLogService.registrar() ─
  private static auditFields(u: AuditUser) {
    return {
      autorId:   u.sub,
      autorNome: u.nome,
      autorRole: u.role,
      ip:        u.ip,
      userAgent: u.userAgent,
    };
  }

  // ── Fire-and-forget seguro — suprime a promise floating; erro vai ao log ──────
  private deleteImagemAsync(publicId: string, contexto: string): void {
    void this.uploadService.deleteFile(publicId).catch((e: unknown) =>
      this.logger.warn(
        `[Comunicado] ${contexto}: ${(e as Error).message}`,
      ),
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  //  CRUD
  // ────────────────────────────────────────────────────────────────────────────

  async create(dto: CreateComunicadoDto, auditUser: AuditUser) {
    const comunicado = await this.prisma.comunicado.create({
      data: {
        titulo:     dto.titulo,
        conteudo:   dto.conteudo,
        categoria:  dto.categoria,
        fixado:     dto.fixado ?? false,
        autorId:    auditUser.sub,
        imagemCapa: dto.imagemCapa,
      },
      select: COMUNICADO_SELECT,
    });

    void this.auditService.registrar({
      entidade:   'Comunicado',
      registroId: comunicado.id,
      acao:       AuditAcao.CRIAR,
      ...ComunicadosService.auditFields(auditUser),
      newValue:   comunicado,
    });

    return comunicado;
  }

  async findAll(query: QueryComunicadoDto = {}) {
    const { page = 1, limit = 10, titulo, categoria } = query;
    const skip = (page - 1) * limit;

    // Tipo seguro — elimina o 'any' que desactivava a verificação do Prisma
    const where: Prisma.ComunicadoWhereInput = {
      ...(titulo    && { titulo:    { contains: titulo, mode: 'insensitive' } }),
      ...(categoria && { categoria }),
    };

    const [data, total] = await Promise.all([
      this.prisma.comunicado.findMany({
        where,
        skip,
        take:    limit,
        select:  COMUNICADO_SELECT,
        orderBy: [{ fixado: 'desc' }, { criadoEm: 'desc' }],
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
      where:  { id },
      select: COMUNICADO_SELECT,
    });

    if (!comunicado) throw new NotFoundException('Comunicado não encontrado.');
    return comunicado;
  }

  async update(id: string, dto: UpdateComunicadoDto, auditUser: AuditUser) {
    // Cláusula de guarda — garante 404 antes de qualquer mutação
    const comunicadoAntigo = await this.findOne(id);

    const comunicadoAtualizado = await this.prisma.comunicado.update({
      where:  { id },
      data:   {
        titulo:     dto.titulo,
        conteudo:   dto.conteudo,
        categoria:  dto.categoria,
        fixado:     dto.fixado,
        imagemCapa: dto.imagemCapa,
      },
      select: COMUNICADO_SELECT,
    });

    // Remoção da imagem antiga é operação auxiliar — não bloqueia a resposta HTTP
    const imagemSubstituida =
      !!comunicadoAntigo.imagemCapa &&
      dto.imagemCapa !== undefined &&
      comunicadoAntigo.imagemCapa !== dto.imagemCapa;

    if (imagemSubstituida) {
      this.deleteImagemAsync(
        comunicadoAntigo.imagemCapa!,
        'Falha não-obstrutiva ao remover imagem antiga do Cloudinary',
      );
    }

    void this.auditService.registrar({
      entidade:   'Comunicado',
      registroId: id,
      acao:       AuditAcao.ATUALIZAR,
      ...ComunicadosService.auditFields(auditUser),
      oldValue:   omitAutor(comunicadoAntigo),
      newValue:   comunicadoAtualizado,
    });

    return comunicadoAtualizado;
  }

  async remove(id: string, auditUser: AuditUser) {
    // Cláusula de guarda — garante 404 antes do delete
    const comunicado = await this.findOne(id);

    const result = await this.prisma.comunicado.delete({ where: { id } });

    // Remoção do asset no Cloudinary é auxiliar — não bloqueia a resposta HTTP
    if (comunicado.imagemCapa) {
      this.deleteImagemAsync(
        comunicado.imagemCapa,
        'Falha não-obstrutiva ao remover capa do Cloudinary',
      );
    }

    void this.auditService.registrar({
      entidade:   'Comunicado',
      registroId: id,
      acao:       AuditAcao.EXCLUIR,
      ...ComunicadosService.auditFields(auditUser),
      oldValue:   omitAutor(comunicado),
    });

    return result;
  }
}