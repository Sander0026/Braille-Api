import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAcao, CategoriaArquivoAtendimentoIndividual } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../../upload/upload.service';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { AuditUser } from '../../common/interfaces/audit-user.interface';
import { AtendimentosIndividuaisPolicy } from '../policies/atendimentos-individuais.policy';
import { AtendimentosIndividuaisAuditService } from './atendimentos-individuais-audit.service';
import {
  AtendimentosIndividuaisSanitizerService,
  ArquivoAtendimentoResponse,
} from './atendimentos-individuais-sanitizer.service';

const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg'];
const ALLOWED_MIMES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];

const ARQUIVO_INCLUDE = {
  atendimento: {
    include: {
      acompanhamento: {
        select: { id: true, alunoId: true, professorId: true },
      },
    },
  },
};

@Injectable()
export class ArquivosAtendimentosIndividuaisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
    private readonly policy: AtendimentosIndividuaisPolicy,
    private readonly sanitizer: AtendimentosIndividuaisSanitizerService,
    private readonly audit: AtendimentosIndividuaisAuditService,
  ) {}

  async anexar(
    atendimentoId: string,
    file: Express.Multer.File,
    categoria: CategoriaArquivoAtendimentoIndividual,
    authUser: AuthenticatedUser | undefined,
    auditUser: AuditUser,
  ): Promise<ArquivoAtendimentoResponse> {
    const atendimento = await this.prisma.atendimentoIndividual.findFirst({
      where: { id: atendimentoId, excluidoEm: null },
      include: { acompanhamento: true },
    });
    if (!atendimento) throw new NotFoundException('Atendimento individual nao encontrado.');
    this.policy.assertCanAttachFile(authUser, atendimento.acompanhamento);
    this.validarArquivo(file);

    const upload = await this.uploadService.uploadArquivoAtendimento(file, auditUser);
    const arquivo = await this.prisma.arquivoAtendimentoIndividual.create({
      data: {
        atendimentoId,
        nomeOriginal: file.originalname,
        nomeArquivo: this.extrairNomeArquivo(upload.url) || file.originalname,
        urlArquivo: upload.url,
        tipoArquivo: file.mimetype,
        tamanho: Math.max(file.size ?? 0, file.buffer?.length ?? 0),
        categoria,
        criadoPorId: auditUser.sub || undefined,
      },
    });

    this.audit.registrar('ArquivoAtendimentoIndividual', arquivo.id, AuditAcao.CRIAR, auditUser, undefined, {
      atendimentoId,
      categoria: arquivo.categoria,
      tipoArquivo: arquivo.tipoArquivo,
      tamanho: arquivo.tamanho,
    });

    return this.sanitizer.sanitizarArquivo(arquivo);
  }

  async obterParaDownload(id: string, authUser?: AuthenticatedUser, auditUser?: AuditUser) {
    const arquivo = await this.prisma.arquivoAtendimentoIndividual.findUnique({
      where: { id },
      include: ARQUIVO_INCLUDE,
    });

    if (!arquivo || arquivo.excluidoEm) throw new NotFoundException('Arquivo do atendimento nao encontrado.');
    this.policy.assertCanDownloadFile(authUser, arquivo.atendimento.acompanhamento);

    if (auditUser) {
      this.audit.registrar('ArquivoAtendimentoIndividual', arquivo.id, AuditAcao.DOWNLOAD, auditUser, undefined, {
        arquivoId: arquivo.id,
        atendimentoId: arquivo.atendimentoId,
        acompanhamentoId: arquivo.atendimento.acompanhamento.id,
        alunoId: arquivo.atendimento.alunoId,
        professorId: arquivo.atendimento.professorId,
        categoria: arquivo.categoria,
        tipoArquivo: arquivo.tipoArquivo,
        usuarioId: auditUser.sub,
        baixadoEm: new Date().toISOString(),
      });
    }

    return {
      url: arquivo.urlArquivo,
      nomeOriginal: arquivo.nomeOriginal,
      tipoArquivo: arquivo.tipoArquivo,
    };
  }

  async arquivar(
    id: string,
    motivoExclusao: string | undefined,
    authUser: AuthenticatedUser | undefined,
    auditUser: AuditUser,
  ): Promise<ArquivoAtendimentoResponse> {
    const arquivo = await this.prisma.arquivoAtendimentoIndividual.findUnique({
      where: { id },
      include: ARQUIVO_INCLUDE,
    });

    if (!arquivo || arquivo.excluidoEm) throw new NotFoundException('Arquivo do atendimento nao encontrado.');
    this.policy.assertCanRemoveFile(authUser, arquivo.atendimento.acompanhamento, arquivo.criadoPorId);

    const atualizado = await this.prisma.arquivoAtendimentoIndividual.update({
      where: { id },
      data: {
        excluidoEm: new Date(),
        excluidoPorId: auditUser.sub || undefined,
        motivoExclusao,
      },
    });

    this.audit.registrar('ArquivoAtendimentoIndividual', id, AuditAcao.ARQUIVAR, auditUser, {
      categoria: arquivo.categoria,
      tipoArquivo: arquivo.tipoArquivo,
    }, {
      arquivoId: arquivo.id,
      atendimentoId: arquivo.atendimentoId,
      acompanhamentoId: arquivo.atendimento.acompanhamento.id,
      alunoId: arquivo.atendimento.alunoId,
      professorId: arquivo.atendimento.professorId,
      categoria: arquivo.categoria,
      tipoArquivo: arquivo.tipoArquivo,
      excluidoEm: atualizado.excluidoEm,
      excluidoPorId: atualizado.excluidoPorId,
      motivoExclusao: atualizado.motivoExclusao,
    });

    return this.sanitizer.sanitizarArquivo(atualizado);
  }

  // ─── Helpers privados ─────────────────────────────────────────────────

  private validarArquivo(file: Express.Multer.File): void {
    const lowerName = file.originalname.toLowerCase();
    const hasAllowedExtension = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    if (!hasAllowedExtension || !ALLOWED_MIMES.includes(file.mimetype)) {
      throw new BadRequestException('Arquivo invalido. Envie PDF, PNG, JPG ou JPEG.');
    }

    const buffer = file.buffer;
    const isPdf = file.mimetype === 'application/pdf' && buffer.subarray(0, 4).toString('utf8') === '%PDF';
    const isPng = file.mimetype === 'image/png'
      && buffer.length >= 8
      && buffer[0] === 0x89
      && buffer[1] === 0x50
      && buffer[2] === 0x4e
      && buffer[3] === 0x47;
    const isJpeg = (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg')
      && buffer.length >= 3
      && buffer[0] === 0xff
      && buffer[1] === 0xd8
      && buffer[2] === 0xff;

    if (!isPdf && !isPng && !isJpeg) {
      throw new BadRequestException('Assinatura do arquivo nao corresponde ao tipo informado.');
    }
  }

  private extrairNomeArquivo(url: string): string | null {
    try {
      return decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).at(-1) ?? '');
    } catch {
      return null;
    }
  }
}
