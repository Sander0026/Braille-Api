import { Injectable, ConflictException, NotFoundException, Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { UpdateBeneficiaryDto } from './dto/update-beneficiary.dto';
import { PrismaService } from '../prisma/prisma.service';
import { QueryBeneficiaryDto } from './dto/query-beneficiary.dto';
import { gerarMatriculaAluno } from '../common/helpers/matricula.helper';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAcao } from '@prisma/client';

@Injectable()
export class BeneficiariesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditLogService,
    @Inject(REQUEST) private request: any
  ) { }

  async create(createBeneficiaryDto: CreateBeneficiaryDto) {
    const orCondition: any[] = [];
    if (createBeneficiaryDto.cpf) orCondition.push({ cpf: createBeneficiaryDto.cpf });
    if (createBeneficiaryDto.rg) orCondition.push({ rg: createBeneficiaryDto.rg });

    const alunoExistente = orCondition.length > 0 
      ? await this.prisma.aluno.findFirst({ where: { OR: orCondition } })
      : null;

    if (alunoExistente) {
      // Se está ativo, bloqueia com conflito real
      if (alunoExistente.statusAtivo && !alunoExistente.excluido) {
        throw new ConflictException('Já existe um aluno ativo com este CPF/RG.');
      }
      // Se está inativo, retorna sinal para o frontend perguntar se quer reativar
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

    // Gera número de matrícula automaticamente
    const matricula = await gerarMatriculaAluno(this.prisma);

    const dadosParaSalvar = {
      ...createBeneficiaryDto,
      matricula,
      dataNascimento: new Date(createBeneficiaryDto.dataNascimento)
    };

    const alunoNovo = await this.prisma.aluno.create({ data: dadosParaSalvar });

    this.auditService.registrar({
      entidade: 'Aluno',
      registroId: alunoNovo.id,
      acao: AuditAcao.CRIAR,
      newValue: alunoNovo,
    });

    return alunoNovo;
  }

  async reactivate(id: string) {
    const aluno = await this.prisma.aluno.findUnique({ where: { id } });
    if (!aluno) throw new NotFoundException('Aluno não encontrado.');

    // RA ÚNCO: O RA (matrícula) nunca muda. É o "CPF interno" do Instituto.
    // Se o aluno já tem matrícula, preserva. Só gera nova se estava vazio
    // (cenário de migração de dados legados sem matrícula gerada).
    const matricula = aluno.matricula ?? await gerarMatriculaAluno(this.prisma);

    const result = await this.prisma.aluno.update({
      where: { id },
      data: { statusAtivo: true, excluido: false, matricula },
      select: {
        id: true, nomeCompleto: true, cpf: true, rg: true, matricula: true,
        statusAtivo: true, criadoEm: true,
      }
    });

    this.auditService.registrar({
      entidade: 'Aluno',
      registroId: id,
      acao: AuditAcao.RESTAURAR,
      oldValue: { statusAtivo: false },
      newValue: { statusAtivo: true },
    });

    return result;
  }

  /** Verificação rápida: retorna se um CPF/RG já existe no sistema (sem lançar exceção) */
  async checkCpfRg(cpf?: string, rg?: string): Promise<
    | { status: 'livre' }
    | { status: 'ativo'; id: string; nomeCompleto: string; matricula: string | null }
    | { status: 'inativo'; id: string; nomeCompleto: string; matricula: string | null; excluido: boolean }
  > {
    const cpfLimpo = (cpf ?? '').replace(/\D/g, '');
    const rgLimpo = (rg ?? '').trim();
    if (!cpfLimpo && !rgLimpo) return { status: 'livre' };

    const orCondition: any[] = [];
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
    return { status: 'inativo', id: aluno.id, nomeCompleto: aluno.nomeCompleto, matricula: aluno.matricula, excluido: aluno.excluido };
  }

  async findAll(query: QueryBeneficiaryDto) {
    const {
      page = 1, limit = 10,
      busca, nome,   // busca = campo novo (OR em nome+matrícula); nome = legado
      inativos,
      tipoDeficiencia, causaDeficiencia, prefAcessibilidade, precisaAcompanhante,
      genero, corRaca, estadoCivil, cidade, uf,
      escolaridade, rendaFamiliar,
      dataCadastroInicio, dataCadastroFim,
    } = query;

    const skip = (page - 1) * limit;

    // ── Cláusula WHERE dinâmica ────────────────────────────────
    const where: any = {
      excluido: false,
      statusAtivo: inativos ? false : true,
    };

    // ── Busca unificada: nome OU matrícula (case-insensitive) ──────
    const termoBusca = (busca ?? nome)?.trim();
    if (termoBusca) {
      where.OR = [
        { nomeCompleto: { contains: termoBusca, mode: 'insensitive' } },
        { matricula: { contains: termoBusca, mode: 'insensitive' } },
      ];
    }

    // Filtros de Deficiência (Enums — valor exato)
    if (tipoDeficiencia) where.tipoDeficiencia = tipoDeficiencia;
    if (causaDeficiencia) where.causaDeficiencia = causaDeficiencia;
    if (prefAcessibilidade) where.prefAcessibilidade = prefAcessibilidade;
    if (precisaAcompanhante !== undefined) {
      where.precisaAcompanhante = precisaAcompanhante;
    }

    // Filtros de Dados Pessoais (texto — case-insensitive)
    if (genero?.trim()) where.genero = { contains: genero.trim(), mode: 'insensitive' };
    if (corRaca) where.corRaca = corRaca;
    if (estadoCivil?.trim()) where.estadoCivil = { contains: estadoCivil.trim(), mode: 'insensitive' };

    // Filtros de Localização (texto — case-insensitive)
    if (cidade?.trim()) where.cidade = { contains: cidade.trim(), mode: 'insensitive' };
    if (uf?.trim()) where.uf = { contains: uf.trim().toUpperCase(), mode: 'insensitive' };

    // Filtros Socioeconômicos (texto — case-insensitive)
    if (escolaridade?.trim()) where.escolaridade = { contains: escolaridade.trim(), mode: 'insensitive' };
    if (rendaFamiliar?.trim()) where.rendaFamiliar = { contains: rendaFamiliar.trim(), mode: 'insensitive' };

    // Filtro por Data de Cadastro (range de criadoEm)
    if (dataCadastroInicio || dataCadastroFim) {
      where.criadoEm = {};
      if (dataCadastroInicio) where.criadoEm.gte = new Date(dataCadastroInicio);
      if (dataCadastroFim) {
        // Inclui o dia inteiro: vai até 23:59:59 do dia final
        const fim = new Date(dataCadastroFim);
        fim.setHours(23, 59, 59, 999);
        where.criadoEm.lte = fim;
      }
    }

    // ── Executar a query ───────────────────────────────────────
    const [alunos, total] = await Promise.all([
      this.prisma.aluno.findMany({
        where,
        skip,
        take: limit,
        select: {
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
        },
        orderBy: { nomeCompleto: 'asc' },
      }),
      this.prisma.aluno.count({ where }),
    ]);

    return {
      data: alunos,
      meta: { total, page, lastPage: Math.ceil(total / limit) },
    };
  }

  // ── Exportação para Excel (.xlsx) ─────────────────────────────────
  async exportToXlsx(query: QueryBeneficiaryDto): Promise<Buffer> {
    const {
      nome, inativos,
      tipoDeficiencia, causaDeficiencia, prefAcessibilidade, precisaAcompanhante,
      genero, corRaca, estadoCivil, cidade, uf,
      escolaridade, rendaFamiliar,
      dataCadastroInicio, dataCadastroFim,
    } = query;

    // Reutiliza exatamente a mesma lógica WHERE, mas SEM paginação
    const where: any = { excluido: false, statusAtivo: inativos ? false : true };
    if (nome?.trim()) where.nomeCompleto = { contains: nome.trim(), mode: 'insensitive' };
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
      where.criadoEm = {};
      if (dataCadastroInicio) where.criadoEm.gte = new Date(dataCadastroInicio);
      if (dataCadastroFim) {
        const fim = new Date(dataCadastroFim);
        fim.setHours(23, 59, 59, 999);
        where.criadoEm.lte = fim;
      }
    }

    // Busca todos sem limite
    const alunos = await this.prisma.aluno.findMany({
      where,
      orderBy: { nomeCompleto: 'asc' },
      select: {
        nomeCompleto: true, cpf: true, rg: true, matricula: true, dataNascimento: true, genero: true,
        estadoCivil: true, telefoneContato: true, email: true,
        cep: true, rua: true, numero: true, bairro: true, cidade: true, uf: true,
        tipoDeficiencia: true, causaDeficiencia: true, prefAcessibilidade: true,
        precisaAcompanhante: true, tecAssistivas: true,
        escolaridade: true, profissao: true, rendaFamiliar: true, beneficiosGov: true,
        statusAtivo: true, criadoEm: true,
        corRaca: true,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Instituto Louis Braille';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Alunos', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    });

    // Cabeçalho estilizado
    const headers = [
      { header: 'Nome Completo', key: 'nome', width: 35 },
      { header: 'CPF/RG', key: 'documento', width: 22 },
      { header: 'Nascimento', key: 'nasc', width: 14 },
      { header: 'Gênero', key: 'genero', width: 14 },
      { header: 'Estado Civil', key: 'estCivil', width: 16 },
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

    sheet.columns = headers.map(h => ({
      header: h.header, key: h.key, width: h.width,
      style: { font: { name: 'Arial', size: 10 } },
    }));

    // Estilo do cabeçalho (linha 1)
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        bottom: { style: 'medium', color: { argb: 'FF2563EB' } },
      };
    });
    headerRow.height = 22;

    const fmtData = (d: Date) => d ? d.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '';

    // Preenchimento dos dados
    alunos.forEach((a, idx) => {
      const row = sheet.addRow({
        nome: a.nomeCompleto,
        documento: (a.cpf || '') + (a.cpf && a.rg ? ' / ' : '') + (a.rg || ''),
        nasc: fmtData(a.dataNascimento),
        genero: a.genero ?? '',
        estCivil: a.estadoCivil ?? '',
        tel: a.telefoneContato ?? '',
        email: a.email ?? '',
        cep: a.cep ?? '',
        rua: a.rua ?? '',
        num: a.numero ?? '',
        bairro: a.bairro ?? '',
        cidade: a.cidade ?? '',
        uf: a.uf ?? '',
        tipoDef: a.tipoDeficiencia?.replace(/_/g, ' ') ?? '',
        causa: a.causaDeficiencia?.replace(/_/g, ' ') ?? '',
        pref: a.prefAcessibilidade?.replace(/_/g, ' ') ?? '',
        acomp: a.precisaAcompanhante ? 'Sim' : 'Não',
        tec: a.tecAssistivas ?? '',
        corRaca: a.corRaca?.replace('_', ' ') ?? '',
        esc: a.escolaridade ?? '',
        prof: a.profissao ?? '',
        renda: a.rendaFamiliar ?? '',
        benef: a.beneficiosGov ?? '',
        status: a.statusAtivo ? 'Ativo' : 'Inativo',
        criado: fmtData(a.criadoEm),
      });

      // Zebra (alternado)
      if (idx % 2 === 1) {
        row.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F6FF' } };
        });
      }
    });

    // Congela a linha do cabeçalho
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as Buffer;
  }

  async findOne(id: string) {
    const beneficiario = await this.prisma.aluno.findUnique({
      where: { id },
      include: { matriculasOficina: { include: { turma: true } } }
    });
    if (!beneficiario) throw new NotFoundException('Beneficiário não encontrado.');
    return beneficiario;
  }

  async update(id: string, updateBeneficiaryDto: UpdateBeneficiaryDto) {
    const beneficiarioAntigo = await this.findOne(id);
    (this.request as any).auditOldValue = beneficiarioAntigo;

    let dadosParaAtualizar: any = { ...updateBeneficiaryDto };
    if (updateBeneficiaryDto.dataNascimento) {
      dadosParaAtualizar.dataNascimento = new Date(updateBeneficiaryDto.dataNascimento);
    }
    const alunoAtualizado = await this.prisma.aluno.update({ where: { id }, data: dadosParaAtualizar });

    this.auditService.registrar({
      entidade: 'Aluno',
      registroId: id,
      acao: AuditAcao.ATUALIZAR,
      oldValue: beneficiarioAntigo,
      newValue: alunoAtualizado,
    });

    return alunoAtualizado;
  }

  async remove(id: string) {
    const beneficiarioAntigo = await this.findOne(id);
    (this.request as any).auditOldValue = beneficiarioAntigo;

    const result = await this.prisma.aluno.update({ where: { id }, data: { statusAtivo: false } });
    this.auditService.registrar({
      entidade: 'Aluno',
      registroId: id,
      acao: AuditAcao.EXCLUIR,
      oldValue: beneficiarioAntigo,
      newValue: { ...beneficiarioAntigo, statusAtivo: false },
    });
    return result;
  }

  async restore(id: string) {
    const beneficiarioAntigo = await this.findOne(id);
    (this.request as any).auditOldValue = beneficiarioAntigo;

    const result = await this.prisma.aluno.update({ where: { id }, data: { statusAtivo: true } });
    this.auditService.registrar({
      entidade: 'Aluno',
      registroId: id,
      acao: AuditAcao.RESTAURAR,
      oldValue: beneficiarioAntigo,
      newValue: { ...beneficiarioAntigo, statusAtivo: true },
    });
    return result;
  }

  async removeHard(id: string) {
    const beneficiarioAntigo = await this.findOne(id);
    (this.request as any).auditOldValue = beneficiarioAntigo;

    const result = await this.prisma.aluno.update({ where: { id }, data: { excluido: true } });
    this.auditService.registrar({
      entidade: 'Aluno',
      registroId: id,
      acao: AuditAcao.ARQUIVAR,
      oldValue: beneficiarioAntigo,
      newValue: { ...beneficiarioAntigo, excluido: true },
    });
    return result;
  }

  // ── Importação via Planilha (XLSX / CSV) ────────────────────────────

  // Tabelas de normalização: aceita português legível OU string exata do enum
  private readonly TIPO_DEFICIENCIA_MAP: Record<string, string> = {
    'cegueira total': 'CEGUEIRA_TOTAL', 'cegueira_total': 'CEGUEIRA_TOTAL',
    'baixa visao': 'BAIXA_VISAO', 'baixa_visao': 'BAIXA_VISAO', 'baixa visão': 'BAIXA_VISAO',
    'visao monocular': 'VISAO_MONOCULAR', 'visao_monocular': 'VISAO_MONOCULAR', 'visão monocular': 'VISAO_MONOCULAR',
  };

  private readonly CAUSA_DEFICIENCIA_MAP: Record<string, string> = {
    'congenita': 'CONGENITA', 'congênita': 'CONGENITA', 'congenito': 'CONGENITA', 'congênito': 'CONGENITA',
    'adquirida': 'ADQUIRIDA', 'adquirido': 'ADQUIRIDA',
  };

  private readonly PREF_ACESSIBILIDADE_MAP: Record<string, string> = {
    'braille': 'BRAILLE',
    'fonte ampliada': 'FONTE_AMPLIADA', 'fonte_ampliada': 'FONTE_AMPLIADA',
    'arquivo digital': 'ARQUIVO_DIGITAL', 'arquivo_digital': 'ARQUIVO_DIGITAL',
    'audio': 'AUDIO', 'áudio': 'AUDIO',
  };

  private readonly COR_RACA_MAP: Record<string, string> = {
    'branca': 'BRANCA', 'branco': 'BRANCA',
    'preta': 'PRETA', 'preto': 'PRETA',
    'parda': 'PARDA', 'pardo': 'PARDA',
    'amarela': 'AMARELA', 'amarelo': 'AMARELA',
    'indígena': 'INDIGENA', 'indigena': 'INDIGENA',
    'prefiro não responder': 'NAO_DECLARADO', 'não declarado': 'NAO_DECLARADO', 'nao declarado': 'NAO_DECLARADO',
  };

  private normalizarEnum<T extends string>(
    valor: string,
    mapa: Record<string, string>,
    enumValidos: T[],
    nomeCampo: string,
  ): { valor: T | null; erro?: string } {
    if (!valor) return { valor: null };
    // Aceita exatamente o valor do enum
    if (enumValidos.includes(valor as T)) return { valor: valor as T };
    // Tenta via mapa normalizador
    const normalizado = mapa[valor.toLowerCase().trim()];
    if (normalizado && enumValidos.includes(normalizado as T)) return { valor: normalizado as T };

    return {
      valor: null,
      erro: `${nomeCampo} inválido: "${valor}". Valores aceitos: ${enumValidos.join(' | ')}`,
    };
  }


  async importFromSheet(buffer: Buffer): Promise<{
    importados: number;
    ignorados: number;
    erros: { linha: number; documento: string; motivo: string }[];
  }> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];

    // Sem cellDates — evita bug de timezone com seriais do Excel
    const rawRows: any[][] = XLSX.utils.sheet_to_json(
      workbook.Sheets[sheetName],
      { header: 1, defval: '' },
    );

    if (rawRows.length < 3) {
      return { importados: 0, ignorados: 0, erros: [{ linha: 0, documento: '—', motivo: 'Planilha vazia ou sem dados.' }] };
    }

    // Linha 0 = labels | Linha 1 = cabeçalhos | Linha 2+ = dados
    const headers: string[] = rawRows[1].map((h: any) => String(h ?? '').trim());
    const dataRows = rawRows.slice(2);

    const rows: Record<string, any>[] = dataRows.map((row) => {
      const obj: Record<string, any> = {};
      headers.forEach((key, idx) => { obj[key] = row[idx] ?? ''; });
      return obj;
    });

    const erros: { linha: number; documento: string; motivo: string }[] = [];
    const validos: any[] = [];
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

      if (!nomeCompleto) { erros.push({ linha, documento: documentoVisivel, motivo: 'Campo obrigatório ausente: NomeCompleto' }); continue; }
      if (!cpf && !rg) { erros.push({ linha, documento: '—', motivo: 'Campo obrigatório ausente: CPF ou RG' }); continue; }
      if (!dataNascimentoRaw && dataNascimentoRaw !== 0) { erros.push({ linha, documento: documentoVisivel, motivo: 'Campo obrigatório ausente: DataNascimento' }); continue; }

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
          const d = dataNascimentoRaw as Date;
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
        if (anoNasc < 1900 || anoNasc > new Date().getFullYear()) throw new Error(`Ano invalido: ${anoNasc}`);
      } catch {
        erros.push({ linha, documento: documentoVisivel, motivo: `DataNascimento invalida: "${dataNascimentoRaw}". Use DD/MM/AAAA ou AAAA-MM-DD` });
        continue;
      }

      const rTipo = this.normalizarEnum(
        String(row['TipoDeficiencia'] ?? '').trim(),
        this.TIPO_DEFICIENCIA_MAP,
        ['CEGUEIRA_TOTAL', 'BAIXA_VISAO', 'VISAO_MONOCULAR'],
        'TipoDeficiencia',
      );
      if (rTipo.erro) { erros.push({ linha, documento: documentoVisivel, motivo: rTipo.erro }); continue; }

      const rCausa = this.normalizarEnum(
        String(row['CausaDeficiencia'] ?? '').trim(),
        this.CAUSA_DEFICIENCIA_MAP,
        ['CONGENITA', 'ADQUIRIDA'],
        'CausaDeficiencia',
      );
      if (rCausa.erro) { erros.push({ linha, documento: documentoVisivel, motivo: rCausa.erro }); continue; }

      const rPref = this.normalizarEnum(
        String(row['PrefAcessibilidade'] ?? '').trim(),
        this.PREF_ACESSIBILIDADE_MAP,
        ['BRAILLE', 'FONTE_AMPLIADA', 'ARQUIVO_DIGITAL', 'AUDIO'],
        'PrefAcessibilidade',
      );
      if (rPref.erro) { erros.push({ linha, documento: documentoVisivel, motivo: rPref.erro }); continue; }

      const rCorRaca = this.normalizarEnum(
        String(row['CorRaca'] ?? '').trim(),
        this.COR_RACA_MAP,
        ['BRANCA', 'PRETA', 'PARDA', 'AMARELA', 'INDIGENA', 'NAO_DECLARADO'],
        'CorRaca',
      );
      if (rCorRaca.erro && String(row['CorRaca'] ?? '').trim() !== '') { 
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

    if (validos.length === 0) {
      return { importados: 0, ignorados: 0, erros };
    }

    // Verificar duplicatas no banco (1 query)
    const cpfsValidos = validos.map(v => v.cpf).filter(Boolean);
    const rgsValidos = validos.map(v => v.rg).filter(Boolean);

    let existentes: any[] = [];
    if (cpfsValidos.length > 0 || rgsValidos.length > 0) {
      const orParams: any[] = [];
      if (cpfsValidos.length) orParams.push({ cpf: { in: cpfsValidos } });
      if (rgsValidos.length) orParams.push({ rg: { in: rgsValidos } });
      existentes = await this.prisma.aluno.findMany({
        where: { OR: orParams },
        select: { cpf: true, rg: true },
      });
    }

    const cpfsExistentes = new Set(existentes.map(e => e.cpf).filter(Boolean));
    const rgsExistentes = new Set(existentes.map(e => e.rg).filter(Boolean));

    const paraInserir: any[] = [];
    let ignorados = 0;

    for (const aluno of validos) {
      if ((aluno.cpf && cpfsExistentes.has(aluno.cpf)) || (aluno.rg && rgsExistentes.has(aluno.rg))) {
        erros.push({ linha: 0, documento: aluno.cpf || aluno.rg, motivo: 'CPF ou RG ja cadastrado no sistema' });
        ignorados++;
      } else {
        paraInserir.push(aluno);
      }
    }

    if (paraInserir.length > 0) {
      const ano = new Date().getFullYear();
      const prefix = `${ano}`;
      let baseCount = await this.prisma.aluno.count({
        where: { matricula: { startsWith: prefix } },
      });
      for (const aluno of paraInserir) {
        aluno.matricula = `${prefix}${String(++baseCount).padStart(5, '0')}`;
      }

      try {
        await this.prisma.aluno.createMany({
          data: paraInserir,
          skipDuplicates: false,
        });
      } catch (err: any) {
        console.error('ERRO NO IMPORT createMany:', err?.code, err?.message?.substring(0, 300));
        throw err;
      }

      // Auditoria individual por aluno (background)
      Promise.resolve().then(async () => {
        for (const aluno of paraInserir) {
          await this.auditService.registrar({
            entidade: 'Aluno',
            registroId: aluno.matricula ?? 'sem-matricula',
            acao: AuditAcao.CRIAR,
            newValue: { ...aluno, origem: 'importacao-planilha' },
          }).catch(() => { });
        }
      });
    }

    return { importados: paraInserir.length, ignorados, erros };
  }
}
