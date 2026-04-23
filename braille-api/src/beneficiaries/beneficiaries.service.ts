import { Injectable, ConflictException, InternalServerErrorException, NotFoundException, Logger } from '@nestjs/common';
import { Prisma, AuditAcao } from '@prisma/client';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { UpdateBeneficiaryDto } from './dto/update-beneficiary.dto';
import { PrismaService } from '../prisma/prisma.service';
import { QueryBeneficiaryDto } from './dto/query-beneficiary.dto';
import { gerarMatriculaAluno } from '../common/helpers/matricula.helper';
import { AuditLogService } from '../audit-log/audit-log.service';
import { UploadService } from '../upload/upload.service';
import { AuditUser } from '../common/interfaces/audit-user.interface';
import * as ExcelJS from 'exceljs';

// ── Selects Cirúrgicos — fonte única de verdade ────────────────────────────

/** Campos para listagem paginada — sem dados pesados */
const ALUNO_LISTA_SELECT = {
  id: true,
  nomeCompleto: true,
  cpf: true,
  rg: true,
  matricula: true,
  dataNascimento: true,
  telefoneContato: true,
  tipoDeficiencia: true,
  statusAtivo: true,
  criadoEm: true,
} as const;

/** Campos para exportação Excel */
const ALUNO_EXPORT_SELECT = {
  nomeCompleto: true,
  cpf: true,
  rg: true,
  matricula: true,
  dataNascimento: true,
  genero: true,
  estadoCivil: true,
  telefoneContato: true,
  email: true,
  cep: true,
  rua: true,
  numero: true,
  bairro: true,
  cidade: true,
  uf: true,
  tipoDeficiencia: true,
  causaDeficiencia: true,
  prefAcessibilidade: true,
  precisaAcompanhante: true,
  tecAssistivas: true,
  escolaridade: true,
  profissao: true,
  rendaFamiliar: true,
  beneficiosGov: true,
  statusAtivo: true,
  criadoEm: true,
  corRaca: true,
} as const;

/** Include para o endpoint público GET /:id — mantém contrato com Frontend */
const ALUNO_DETALHE_INCLUDE = {
  matriculasOficina: { include: { turma: true } },
} as const;

/** Select mínimo para verificar existência antes de mutações */
const ALUNO_EXISTENCIA_SELECT = { id: true } as const;

/** Select para update: precisa de fotoPerfil e termoLgpdUrl para cleanup Cloudinary */
const ALUNO_MUTATION_SELECT = { id: true, fotoPerfil: true, termoLgpdUrl: true } as const;

@Injectable()
export class BeneficiariesService {
  private readonly logger = new Logger(BeneficiariesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditLogService,
    private readonly uploadService: UploadService,
  ) {}

  // ── Helpers Privados ───────────────────────────────────────────────────────

  /** Converte AuditUser (campos canônicos) → campos do AuditOptions (autorId/Nome/Role) */
  private toAuditMeta(au?: AuditUser) {
    return {
      autorId: au?.sub,
      autorNome: au?.nome,
      autorRole: au?.role as string | undefined,
      ip: au?.ip,
      userAgent: au?.userAgent,
    };
  }

  /**
   * Verifica existência do aluno e lança NotFoundException se não encontrado.
   * Select mínimo — evita trazer toda a entidade para operações de mutação.
   */
  private async assertExists(id: string): Promise<void> {
    const aluno = await this.prisma.aluno.findUnique({
      where: { id },
      select: ALUNO_EXISTENCIA_SELECT,
    });
    if (!aluno) throw new NotFoundException('Beneficiário não encontrado.');
  }

  /**
   * Remove arquivo antigo do Cloudinary se a URL foi alterada.
   * Erros de deleção são registrados como warning — nunca bloqueiam a operação principal.
   */
  private async deleteFileIfChanged(
    urlAtual: string | null,
    novaUrl: string | null | undefined,
    label: string,
  ): Promise<void> {
    if (novaUrl !== undefined && urlAtual && novaUrl !== urlAtual) {
      try {
        await this.uploadService.deleteFile(urlAtual);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Erro genérico';
        this.logger.warn(`${label} antigo não removido do Cloudinary: ${msg}`);
      }
    }
  }

  /**
   * Constrói o WHERE do Prisma a partir dos filtros do QueryBeneficiaryDto.
   * Fonte única de verdade — reutilizada por findAll() e exportToXlsx() (elimina DRY).
   *
   * Fix de timezone: dataCadastroFim usa -03:00 (BRT) para cobrir o dia
   * inteiro em horário de Brasília (mesmo fix aplicado em audit-log/stats()).
   */
  private buildWhere(query: QueryBeneficiaryDto): Prisma.AlunoWhereInput {
    const {
      busca,
      nome,
      inativos,
      tipoDeficiencia,
      causaDeficiencia,
      prefAcessibilidade,
      precisaAcompanhante,
      genero,
      corRaca,
      estadoCivil,
      cidade,
      uf,
      escolaridade,
      rendaFamiliar,
      dataCadastroInicio,
      dataCadastroFim,
    } = query;

    const where: Prisma.AlunoWhereInput = {
      excluido: false,
      statusAtivo: inativos ? false : true,
    };

    // Busca unificada: nome OU matrícula (case-insensitive)
    const termoBusca = (busca ?? nome)?.trim();
    if (termoBusca) {
      where.OR = [
        { nomeCompleto: { contains: termoBusca, mode: 'insensitive' } },
        { matricula: { contains: termoBusca, mode: 'insensitive' } },
      ];
    }

    if (tipoDeficiencia) where.tipoDeficiencia = tipoDeficiencia;
    if (causaDeficiencia) where.causaDeficiencia = causaDeficiencia;
    if (prefAcessibilidade) where.prefAcessibilidade = prefAcessibilidade;
    if (precisaAcompanhante !== undefined) where.precisaAcompanhante = precisaAcompanhante;
    if (genero?.trim()) where.genero = { contains: genero.trim(), mode: 'insensitive' };
    if (corRaca) where.corRaca = corRaca;
    if (estadoCivil?.trim()) where.estadoCivil = { contains: estadoCivil.trim(), mode: 'insensitive' };
    if (cidade?.trim()) where.cidade = { contains: cidade.trim(), mode: 'insensitive' };
    if (uf?.trim()) where.uf = { contains: uf.trim().toUpperCase(), mode: 'insensitive' };
    if (escolaridade?.trim()) where.escolaridade = { contains: escolaridade.trim(), mode: 'insensitive' };
    if (rendaFamiliar?.trim()) where.rendaFamiliar = { contains: rendaFamiliar.trim(), mode: 'insensitive' };

    if (dataCadastroInicio || dataCadastroFim) {
      where.criadoEm = {
        ...(dataCadastroInicio && { gte: new Date(dataCadastroInicio) }),
        // BRT -03:00: cobre até 23:59:59 do dia final no fuso de Brasília
        ...(dataCadastroFim && { lte: new Date(`${dataCadastroFim}T23:59:59.999-03:00`) }),
      };
    }

    return where;
  }

  // ── Criar ──────────────────────────────────────────────────────────────────

  async create(dto: CreateBeneficiaryDto, auditUser?: AuditUser) {
    const orCondition: Prisma.AlunoWhereInput[] = [];
    if (dto.cpf) orCondition.push({ cpf: dto.cpf });
    if (dto.rg) orCondition.push({ rg: dto.rg });

    const alunoExistente =
      orCondition.length > 0
        ? await this.prisma.aluno.findFirst({
            where: { OR: orCondition },
            select: { id: true, nomeCompleto: true, matricula: true, statusAtivo: true, excluido: true },
          })
        : null;

    if (alunoExistente) {
      if (alunoExistente.statusAtivo && !alunoExistente.excluido) {
        throw new ConflictException('Já existe um aluno ativo com este CPF/RG.');
      }
      return {
        _reativacao: true,
        id: alunoExistente.id,
        nomeCompleto: alunoExistente.nomeCompleto,
        matricula: alunoExistente.matricula,
        statusAtivo: alunoExistente.statusAtivo,
        excluido: alunoExistente.excluido,
        message: 'Já existe um aluno inativo/arquivado com este CPF/RG.',
      };
    }

    const matricula = await gerarMatriculaAluno(this.prisma);
    const { dataNascimento, ...resto } = dto;
    const alunoNovo = await this.prisma.aluno.create({
      data: {
        ...(resto as unknown as Prisma.AlunoCreateInput),
        matricula,
        dataNascimento: new Date(dataNascimento),
      },
    });

    this.auditService.registrar({
      ...this.toAuditMeta(auditUser),
      entidade: 'Aluno',
      registroId: alunoNovo.id,
      acao: AuditAcao.CRIAR,
      newValue: alunoNovo,
    });

    return alunoNovo;
  }

  // ── Reativar ───────────────────────────────────────────────────────────────

  async reactivate(id: string, auditUser?: AuditUser) {
    const aluno = await this.prisma.aluno.findUnique({
      where: { id },
      select: { id: true, matricula: true },
    });
    if (!aluno) throw new NotFoundException('Aluno não encontrado.');

    // RA ÚNICO: preserva matrícula existente; só gera nova em migração legada
    const matricula = aluno.matricula ?? (await gerarMatriculaAluno(this.prisma));

    const result = await this.prisma.aluno.update({
      where: { id },
      data: { statusAtivo: true, excluido: false, matricula },
      select: { id: true, nomeCompleto: true, cpf: true, rg: true, matricula: true, statusAtivo: true, criadoEm: true },
    });

    this.auditService.registrar({
      ...this.toAuditMeta(auditUser),
      entidade: 'Aluno',
      registroId: id,
      acao: AuditAcao.RESTAURAR,
      oldValue: { statusAtivo: false },
      newValue: { statusAtivo: true },
    });

    return result;
  }

  // ── Verificação CPF / RG ───────────────────────────────────────────────────

  async checkCpfRg(
    cpf?: string,
    rg?: string,
  ): Promise<
    | { status: 'livre' }
    | { status: 'ativo'; id: string; nomeCompleto: string; matricula: string | null }
    | { status: 'inativo'; id: string; nomeCompleto: string; matricula: string | null; excluido: boolean }
  > {
    const cpfLimpo = (cpf ?? '').replace(/\D/g, '');
    const rgLimpo = (rg ?? '').trim();
    if (!cpfLimpo && !rgLimpo) return { status: 'livre' };

    const orCondition: Prisma.AlunoWhereInput[] = [];
    if (cpfLimpo) orCondition.push({ cpf: cpfLimpo });
    if (rgLimpo) orCondition.push({ rg: rgLimpo });

    const aluno = await this.prisma.aluno.findFirst({
      where: { OR: orCondition },
      select: { id: true, nomeCompleto: true, matricula: true, statusAtivo: true, excluido: true },
    });

    if (!aluno) return { status: 'livre' };
    if (aluno.statusAtivo && !aluno.excluido) {
      return { status: 'ativo', id: aluno.id, nomeCompleto: aluno.nomeCompleto, matricula: aluno.matricula };
    }
    return {
      status: 'inativo',
      id: aluno.id,
      nomeCompleto: aluno.nomeCompleto,
      matricula: aluno.matricula,
      excluido: aluno.excluido,
    };
  }

  // ── Listar ─────────────────────────────────────────────────────────────────

  async findAll(query: QueryBeneficiaryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = this.buildWhere(query);

    const [alunos, total] = await Promise.all([
      this.prisma.aluno.findMany({
        where,
        skip,
        take: limit,
        select: ALUNO_LISTA_SELECT,
        orderBy: { nomeCompleto: 'asc' },
      }),
      this.prisma.aluno.count({ where }),
    ]);

    return {
      data: alunos,
      meta: { total, page, lastPage: Math.ceil(total / limit) },
    };
  }

  // ── Exportar Excel ─────────────────────────────────────────────────────────

  async exportToXlsx(query: QueryBeneficiaryDto): Promise<Buffer> {
    const where = this.buildWhere(query);
    const alunos = await this.prisma.aluno.findMany({
      where,
      orderBy: { nomeCompleto: 'asc' },
      select: ALUNO_EXPORT_SELECT,
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Instituto Louis Braille';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Alunos', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    });

    const headers = [
      { header: 'Nome Completo', key: 'nome', width: 35 },
      { header: 'Matrícula', key: 'mat', width: 14 },
      { header: 'CPF', key: 'cpf', width: 16 },
      { header: 'RG', key: 'rg', width: 14 },
      { header: 'Nascimento', key: 'nasc', width: 14 },
      { header: 'Gênero', key: 'genero', width: 14 },
      { header: 'Estado Civil', key: 'estCiv', width: 16 },
      { header: 'Telefone', key: 'tel', width: 18 },
      { header: 'E-mail', key: 'email', width: 28 },
      { header: 'CEP', key: 'cep', width: 12 },
      { header: 'Rua', key: 'rua', width: 30 },
      { header: 'Nº', key: 'num', width: 7 },
      { header: 'Bairro', key: 'bairro', width: 20 },
      { header: 'Cidade', key: 'cidade', width: 20 },
      { header: 'UF', key: 'uf', width: 6 },
      { header: 'Tipo Deficiência', key: 'tipoDef', width: 20 },
      { header: 'Causa', key: 'causa', width: 14 },
      { header: 'Pref. Acessibilidade', key: 'pref', width: 22 },
      { header: 'Acompanhante', key: 'acomp', width: 14 },
      { header: 'Tec. Assistivas', key: 'tec', width: 24 },
      { header: 'Cor/Raça', key: 'corRaca', width: 20 },
      { header: 'Escolaridade', key: 'esc', width: 22 },
      { header: 'Profissão', key: 'prof', width: 20 },
      { header: 'Renda Familiar', key: 'renda', width: 22 },
      { header: 'Benefícios Gov.', key: 'benef', width: 22 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Cadastrado em', key: 'criado', width: 16 },
    ];

    sheet.columns = headers.map((h) => ({
      header: h.header,
      key: h.key,
      width: h.width,
      style: { font: { name: 'Arial', size: 10 } },
    }));

    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = { bottom: { style: 'medium', color: { argb: 'FF2563EB' } } };
    });
    headerRow.height = 22;

    const fmtData = (d: Date) => (d ? d.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '');
    const fmtEnum = (v: string | null | undefined) => v?.replaceAll('_', ' ') ?? '';

    alunos.forEach((a, idx) => {
      const row = sheet.addRow({
        nome: a.nomeCompleto,
        mat: a.matricula ?? '',
        cpf: a.cpf ?? '',
        rg: a.rg ?? '',
        nasc: fmtData(a.dataNascimento),
        genero: a.genero ?? '',
        estCiv: a.estadoCivil ?? '',
        tel: a.telefoneContato ?? '',
        email: a.email ?? '',
        cep: a.cep ?? '',
        rua: a.rua ?? '',
        num: a.numero ?? '',
        bairro: a.bairro ?? '',
        cidade: a.cidade ?? '',
        uf: a.uf ?? '',
        tipoDef: fmtEnum(a.tipoDeficiencia),
        causa: fmtEnum(a.causaDeficiencia),
        pref: fmtEnum(a.prefAcessibilidade),
        acomp: a.precisaAcompanhante ? 'Sim' : 'Não',
        tec: a.tecAssistivas ?? '',
        corRaca: fmtEnum(a.corRaca),
        esc: a.escolaridade ?? '',
        prof: a.profissao ?? '',
        renda: a.rendaFamiliar ?? '',
        benef: a.beneficiosGov ?? '',
        status: a.statusAtivo ? 'Ativo' : 'Inativo',
        criado: fmtData(a.criadoEm),
      });

      // Zebra (linhas ímpares)
      if (idx % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F6FF' } };
        });
      }
    });

    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ── Detalhe (Endpoint público — mantém include completo para o Frontend) ──

  async findOne(id: string) {
    const beneficiario = await this.prisma.aluno.findUnique({
      where: { id },
      include: ALUNO_DETALHE_INCLUDE,
    });
    if (!beneficiario) throw new NotFoundException('Beneficiário não encontrado.');
    return beneficiario;
  }

  // ── Atualizar ──────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateBeneficiaryDto, auditUser?: AuditUser) {
    // Select cirúrgico — só precisa de fotoPerfil e termoLgpdUrl para cleanup
    const dadosAtuais = await this.prisma.aluno.findUnique({
      where: { id },
      select: ALUNO_MUTATION_SELECT,
    });
    if (!dadosAtuais) throw new NotFoundException('Beneficiário não encontrado.');

    await Promise.all([
      this.deleteFileIfChanged(dadosAtuais.fotoPerfil, dto.fotoPerfil, 'Foto de perfil'),
      this.deleteFileIfChanged(dadosAtuais.termoLgpdUrl, dto.termoLgpdUrl, 'Documento LGPD'),
    ]);

    const { dataNascimento, ...resto } = dto;
    const alunoAtualizado = await this.prisma.aluno.update({
      where: { id },
      data: {
        ...(resto as unknown as Prisma.AlunoUpdateInput),
        ...(dataNascimento && { dataNascimento: new Date(dataNascimento) }),
      },
    });

    this.auditService.registrar({
      ...this.toAuditMeta(auditUser),
      entidade: 'Aluno',
      registroId: id,
      acao: AuditAcao.ATUALIZAR,
      oldValue: dadosAtuais,
      newValue: alunoAtualizado,
    });

    return alunoAtualizado;
  }

  // ── Inativar / Restaurar / Excluir ─────────────────────────────────────────

  async remove(id: string, auditUser?: AuditUser) {
    await this.assertExists(id);
    const result = await this.prisma.aluno.update({ where: { id }, data: { statusAtivo: false } });
    this.auditService.registrar({
      ...this.toAuditMeta(auditUser),
      entidade: 'Aluno',
      registroId: id,
      acao: AuditAcao.EXCLUIR,
      oldValue: { statusAtivo: true },
      newValue: { statusAtivo: false },
    });
    return result;
  }

  async restore(id: string, auditUser?: AuditUser) {
    await this.assertExists(id);
    const result = await this.prisma.aluno.update({ where: { id }, data: { statusAtivo: true } });
    this.auditService.registrar({
      ...this.toAuditMeta(auditUser),
      entidade: 'Aluno',
      registroId: id,
      acao: AuditAcao.RESTAURAR,
      oldValue: { statusAtivo: false },
      newValue: { statusAtivo: true },
    });
    return result;
  }

  async removeHard(id: string, auditUser?: AuditUser) {
    await this.assertExists(id);
    const result = await this.prisma.aluno.update({ where: { id }, data: { excluido: true } });
    this.auditService.registrar({
      ...this.toAuditMeta(auditUser),
      entidade: 'Aluno',
      registroId: id,
      acao: AuditAcao.ARQUIVAR,
      oldValue: { excluido: false },
      newValue: { excluido: true },
    });
    return result;
  }

  // ── Importação via Planilha (XLSX / CSV) ───────────────────────────────────

  /** Tabelas de normalização: aceita português legível OU string exata do enum */
  private readonly TIPO_DEFICIENCIA_MAP: Record<string, string> = {
    'cegueira total': 'CEGUEIRA_TOTAL',
    cegueira_total: 'CEGUEIRA_TOTAL',
    'baixa visao': 'BAIXA_VISAO',
    baixa_visao: 'BAIXA_VISAO',
    'baixa visão': 'BAIXA_VISAO',
    'visao monocular': 'VISAO_MONOCULAR',
    visao_monocular: 'VISAO_MONOCULAR',
    'visão monocular': 'VISAO_MONOCULAR',
  };

  private readonly CAUSA_DEFICIENCIA_MAP: Record<string, string> = {
    congenita: 'CONGENITA',
    congênita: 'CONGENITA',
    congenito: 'CONGENITA',
    congênito: 'CONGENITA',
    adquirida: 'ADQUIRIDA',
    adquirido: 'ADQUIRIDA',
  };

  private readonly PREF_ACESSIBILIDADE_MAP: Record<string, string> = {
    braille: 'BRAILLE',
    'fonte ampliada': 'FONTE_AMPLIADA',
    fonte_ampliada: 'FONTE_AMPLIADA',
    'arquivo digital': 'ARQUIVO_DIGITAL',
    arquivo_digital: 'ARQUIVO_DIGITAL',
    audio: 'AUDIO',
    áudio: 'AUDIO',
  };

  private readonly COR_RACA_MAP: Record<string, string> = {
    branca: 'BRANCA',
    branco: 'BRANCA',
    preta: 'PRETA',
    preto: 'PRETA',
    parda: 'PARDA',
    pardo: 'PARDA',
    amarela: 'AMARELA',
    amarelo: 'AMARELA',
    indígena: 'INDIGENA',
    indigena: 'INDIGENA',
    'prefiro não responder': 'NAO_DECLARADO',
    'não declarado': 'NAO_DECLARADO',
    'nao declarado': 'NAO_DECLARADO',
    'prefiro não responder / não declarado': 'NAO_DECLARADO',
    'prefiro nao responder / nao declarado': 'NAO_DECLARADO',
  };

  private normalizarEnum<T extends string>(
    valor: string,
    mapa: Record<string, string>,
    enumValidos: T[],
    nomeCampo: string,
  ): { valor: T | null; erro?: string } {
    if (!valor) return { valor: null };
    if (enumValidos.includes(valor as T)) return { valor: valor as T };
    const normalizado = mapa[valor.toLowerCase().trim()];
    if (normalizado && enumValidos.includes(normalizado as T)) return { valor: normalizado as T };
    return {
      valor: null,
      erro: `${nomeCampo} inválido: "${valor}". Valores aceitos: ${enumValidos.join(' | ')}`,
    };
  }

  async importFromSheet(
    buffer: Buffer,
    auditUser?: AuditUser,
  ): Promise<{
    importados: number;
    ignorados: number;
    erros: { linha: number; documento: string; motivo: string }[];
  }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const worksheet = workbook.worksheets[0];

    if (!worksheet || worksheet.rowCount < 3) {
      return {
        importados: 0,
        ignorados: 0,
        erros: [{ linha: 0, documento: '—', motivo: 'Planilha vazia ou sem dados.' }],
      };
    }

    const rawRows: unknown[][] = [];
    worksheet.eachRow((row) => {
      const rowValues = row.values as unknown[];
      const cleanedRow = rowValues.slice(1).map((val) => {
        if (val && typeof val === 'object' && !(val instanceof Date)) {
          return (val as Record<string, unknown>).text ?? (val as Record<string, unknown>).result ?? String(val);
        }
        return val ?? '';
      });
      rawRows.push(cleanedRow);
    });

    if (rawRows.length < 3) {
      return {
        importados: 0,
        ignorados: 0,
        erros: [{ linha: 0, documento: '—', motivo: 'Planilha vazia ou sem dados.' }],
      };
    }

    // Linha 0 = labels | Linha 1 = cabeçalhos | Linha 2+ = dados
    const headers: string[] = rawRows[1].map((h) => String(h ?? '').trim());
    const dataRows = rawRows.slice(2);

    const rows: Record<string, unknown>[] = dataRows.map((row) => {
      const obj: Record<string, unknown> = {};
      headers.forEach((key, idx) => {
        obj[key] = row[idx] ?? '';
      });
      return obj;
    });

    const erros: { linha: number; documento: string; motivo: string }[] = [];
    const validos: Record<string, unknown>[] = [];
    const cpfsNaPlanilha = new Set<string>();
    const rgsNaPlanilha = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const linha = i + 3;
      const row = rows[i];
      const nomeCompleto = String(row['NomeCompleto'] ?? '').trim();
      const cpf = String(row['CPF'] ?? row['CPF_RG'] ?? '').trim();
      const rg = String(row['RG'] ?? '').trim();
      const dataNascimentoRaw = row['DataNascimento'];

      if (!nomeCompleto && !cpf && !rg && !dataNascimentoRaw) continue;

      const documentoVisivel = cpf || rg || '—';

      if (!nomeCompleto) {
        erros.push({ linha, documento: documentoVisivel, motivo: 'Campo obrigatório ausente: NomeCompleto' });
        continue;
      }
      if (!cpf && !rg) {
        erros.push({ linha, documento: '—', motivo: 'Campo obrigatório ausente: CPF ou RG' });
        continue;
      }
      if (!dataNascimentoRaw && dataNascimentoRaw !== 0) {
        erros.push({ linha, documento: documentoVisivel, motivo: 'Campo obrigatório ausente: DataNascimento' });
        continue;
      }

      if ((cpf && cpfsNaPlanilha.has(cpf)) || (rg && rgsNaPlanilha.has(rg))) {
        erros.push({ linha, documento: documentoVisivel, motivo: 'CPF ou RG duplicado na mesma planilha' });
        continue;
      }
      if (cpf) cpfsNaPlanilha.add(cpf);
      if (rg) rgsNaPlanilha.add(rg);

      // Parse de data: serial Excel, DD/MM/AAAA ou AAAA-MM-DD
      let dataNascimento: Date;
      try {
        if (typeof dataNascimentoRaw === 'number') {
          const excelEpoch = new Date(Date.UTC(1899, 11, 30));
          dataNascimento = new Date(excelEpoch.getTime() + Math.round(dataNascimentoRaw) * 86400000);
        } else if (dataNascimentoRaw instanceof Date) {
          const d = dataNascimentoRaw;
          dataNascimento = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
        } else {
          const rawStr = String(dataNascimentoRaw).trim();
          if (rawStr.includes('/')) {
            const [dia, mes, ano] = rawStr.split('/');
            dataNascimento = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)));
          } else {
            const parts = rawStr.split('-');
            dataNascimento = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
          }
        }
        if (Number.isNaN(dataNascimento.getTime())) throw new Error('NaN');
        const anoNasc = dataNascimento.getUTCFullYear();
        if (anoNasc < 1900 || anoNasc > new Date().getFullYear()) throw new Error(`Ano inválido: ${anoNasc}`);
      } catch {
        erros.push({
          linha,
          documento: documentoVisivel,
          motivo: `DataNascimento inválida: "${String(dataNascimentoRaw)}". Use DD/MM/AAAA ou AAAA-MM-DD`,
        });
        continue;
      }

      const rTipo = this.normalizarEnum(
        String(row['TipoDeficiencia'] ?? '').trim(),
        this.TIPO_DEFICIENCIA_MAP,
        ['CEGUEIRA_TOTAL', 'BAIXA_VISAO', 'VISAO_MONOCULAR'],
        'TipoDeficiencia',
      );
      if (rTipo.erro) {
        erros.push({ linha, documento: documentoVisivel, motivo: rTipo.erro });
        continue;
      }

      const rCausa = this.normalizarEnum(
        String(row['CausaDeficiencia'] ?? '').trim(),
        this.CAUSA_DEFICIENCIA_MAP,
        ['CONGENITA', 'ADQUIRIDA'],
        'CausaDeficiencia',
      );
      if (rCausa.erro) {
        erros.push({ linha, documento: documentoVisivel, motivo: rCausa.erro });
        continue;
      }

      const rPref = this.normalizarEnum(
        String(row['PrefAcessibilidade'] ?? '').trim(),
        this.PREF_ACESSIBILIDADE_MAP,
        ['BRAILLE', 'FONTE_AMPLIADA', 'ARQUIVO_DIGITAL', 'AUDIO'],
        'PrefAcessibilidade',
      );
      if (rPref.erro) {
        erros.push({ linha, documento: documentoVisivel, motivo: rPref.erro });
        continue;
      }

      const corRacaRaw = String(row['CorRaca'] ?? '').trim();
      const rCorRaca = this.normalizarEnum(
        corRacaRaw,
        this.COR_RACA_MAP,
        ['BRANCA', 'PRETA', 'PARDA', 'AMARELA', 'INDIGENA', 'NAO_DECLARADO'],
        'CorRaca',
      );
      if (rCorRaca.erro && corRacaRaw !== '') {
        erros.push({ linha, documento: documentoVisivel, motivo: rCorRaca.erro });
        continue;
      }

      validos.push({
        nomeCompleto,
        cpf: cpf || null,
        rg: rg || null,
        dataNascimento,
        genero: String(row['Genero'] ?? '').trim() || null,
        estadoCivil: String(row['EstadoCivil'] ?? '').trim() || null,
        telefoneContato: String(row['Telefone'] ?? '').trim() || null,
        email: String(row['Email'] ?? '').trim() || null,
        cep: String(row['CEP'] ?? '').trim() || null,
        rua: String(row['Rua'] ?? '').trim() || null,
        numero: String(row['Numero'] ?? '').trim() || null,
        bairro: String(row['Bairro'] ?? '').trim() || null,
        cidade: String(row['Cidade'] ?? '').trim() || null,
        uf: String(row['UF'] ?? '').trim() || null,
        contatoEmergencia: String(row['ContatoEmergencia'] ?? '').trim() || null,
        tipoDeficiencia: rTipo.valor,
        causaDeficiencia: rCausa.valor,
        escolaridade: String(row['Escolaridade'] ?? '').trim() || null,
        profissao: String(row['Profissao'] ?? '').trim() || null,
        rendaFamiliar: String(row['RendaFamiliar'] ?? '').trim() || null,
        beneficiosGov: String(row['BeneficiosGov'] ?? '').trim() || null,
        tecAssistivas: String(row['TecAssistivas'] ?? '').trim() || null,
        precisaAcompanhante: String(row['PrecisaAcompanhante'] ?? '').toUpperCase() === 'SIM',
        prefAcessibilidade: rPref.valor,
        corRaca: rCorRaca.valor,
      });
    }

    if (validos.length === 0) return { importados: 0, ignorados: 0, erros };

    // Verificar duplicatas no banco (1 query)
    const cpfsValidos = validos.map((v) => v.cpf).filter(Boolean) as string[];
    const rgsValidos = validos.map((v) => v.rg).filter(Boolean) as string[];

    let existentes: { cpf: string | null; rg: string | null }[] = [];
    if (cpfsValidos.length > 0 || rgsValidos.length > 0) {
      const orParams: Prisma.AlunoWhereInput[] = [];
      if (cpfsValidos.length) orParams.push({ cpf: { in: cpfsValidos } });
      if (rgsValidos.length) orParams.push({ rg: { in: rgsValidos } });
      existentes = await this.prisma.aluno.findMany({
        where: { OR: orParams },
        select: { cpf: true, rg: true },
      });
    }

    const cpfsExistentes = new Set(existentes.map((e) => e.cpf).filter(Boolean));
    const rgsExistentes = new Set(existentes.map((e) => e.rg).filter(Boolean));

    const paraInserir: Record<string, unknown>[] = [];
    let ignorados = 0;

    for (const aluno of validos) {
      if (
        (aluno.cpf && cpfsExistentes.has(aluno.cpf as string)) ||
        (aluno.rg && rgsExistentes.has(aluno.rg as string))
      ) {
        erros.push({
          linha: 0,
          documento: String(aluno.cpf || aluno.rg),
          motivo: 'CPF ou RG já cadastrado no sistema',
        });
        ignorados++;
      } else {
        paraInserir.push(aluno);
      }
    }

    if (paraInserir.length > 0) {
      const ano = new Date().getFullYear();
      const prefix = `${ano}`;

      /**
       * $transaction garante atomicidade: count + createMany ocorrem na mesma tx.
       * Fix de race condition: sem a tx, dois imports simultâneos leriam o mesmo
       * baseCount e gerariam matrículas duplicadas.
       */
      try {
        await this.prisma.$transaction(async (tx) => {
          let baseCount = await tx.aluno.count({ where: { matricula: { startsWith: prefix } } });
          for (const aluno of paraInserir) {
            aluno.matricula = `${prefix}${String(++baseCount).padStart(5, '0')}`;
          }
          await tx.aluno.createMany({ data: paraInserir as Prisma.AlunoCreateManyInput[], skipDuplicates: false });
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        this.logger.error(`ERRO NO IMPORT createMany: ${errorMsg}`);
        // Não relança o erro bruto — evita vazar stack trace do Prisma para o cliente
        throw new InternalServerErrorException(
          'Falha na importação dos dados. Tente novamente ou verifique o arquivo.',
        );
      }

      // Auditoria em background — não bloqueia a resposta ao cliente
      Promise.resolve().then(async () => {
        for (const aluno of paraInserir) {
          await this.auditService
            .registrar({
              ...this.toAuditMeta(auditUser),
              entidade: 'Aluno',
              registroId: String(aluno.matricula ?? 'sem-matricula'),
              acao: AuditAcao.CRIAR,
              newValue: { ...aluno, origem: 'importacao-planilha' },
            })
            .catch(() => {
              /* auditoria nunca deve derrubar a operação */
            });
        }
      });
    }

    return { importados: paraInserir.length, ignorados, erros };
  }
}
