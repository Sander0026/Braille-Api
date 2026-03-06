import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { UpdateBeneficiaryDto } from './dto/update-beneficiary.dto';
import { PrismaService } from '../prisma/prisma.service';
import { QueryBeneficiaryDto } from './dto/query-beneficiary.dto';
import { gerarMatriculaAluno } from '../common/helpers/matricula.helper';

@Injectable()
export class BeneficiariesService {
  constructor(private prisma: PrismaService) { }

  async create(createBeneficiaryDto: CreateBeneficiaryDto) {
    const alunoExistente = await this.prisma.aluno.findUnique({
      where: { cpfRg: createBeneficiaryDto.cpfRg }
    });

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

    return this.prisma.aluno.create({ data: dadosParaSalvar });
  }

  async reactivate(id: string) {
    const aluno = await this.prisma.aluno.findUnique({ where: { id } });
    if (!aluno) throw new NotFoundException('Aluno não encontrado.');

    return this.prisma.aluno.update({
      where: { id },
      data: { statusAtivo: true, excluido: false },
      select: {
        id: true, nomeCompleto: true, cpfRg: true, matricula: true,
        statusAtivo: true, criadoEm: true,
      },
    });
  }

  async findAll(query: QueryBeneficiaryDto) {
    const {
      page = 1, limit = 10,
      busca, nome,   // busca = campo novo (OR em nome+matrícula); nome = legado
      inativos,
      tipoDeficiencia, causaDeficiencia, prefAcessibilidade, precisaAcompanhante,
      genero, estadoCivil, cidade, uf,
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
          cpfRg: true,
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
      genero, estadoCivil, cidade, uf,
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
        nomeCompleto: true, cpfRg: true, dataNascimento: true, genero: true,
        estadoCivil: true, telefoneContato: true, email: true,
        cep: true, rua: true, numero: true, bairro: true, cidade: true, uf: true,
        tipoDeficiencia: true, causaDeficiencia: true, prefAcessibilidade: true,
        precisaAcompanhante: true, tecAssistivas: true,
        escolaridade: true, profissao: true, rendaFamiliar: true, beneficiosGov: true,
        statusAtivo: true, criadoEm: true,
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
      { header: 'CPF / RG', key: 'cpf', width: 18 },
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
        cpf: a.cpfRg,
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
    await this.findOne(id);
    let dadosParaAtualizar: any = { ...updateBeneficiaryDto };
    if (updateBeneficiaryDto.dataNascimento) {
      dadosParaAtualizar.dataNascimento = new Date(updateBeneficiaryDto.dataNascimento);
    }
    return this.prisma.aluno.update({ where: { id }, data: dadosParaAtualizar });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.aluno.update({ where: { id }, data: { statusAtivo: false } });
  }

  async restore(id: string) {
    await this.findOne(id);
    return this.prisma.aluno.update({ where: { id }, data: { statusAtivo: true } });
  }

  async removeHard(id: string) {
    await this.findOne(id);
    return this.prisma.aluno.update({ where: { id }, data: { excluido: true } });
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
    erros: { linha: number; cpfRg: string; motivo: string }[];
  }> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

    const erros: { linha: number; cpfRg: string; motivo: string }[] = [];
    const validos: any[] = [];
    const cpfRgsNaPlanilha = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const linha = i + 2; // linha 1 = cabeçalho no Excel
      const row = rows[i];

      const nomeCompleto = String(row['NomeCompleto'] ?? '').trim();
      const cpfRg = String(row['CPF_RG'] ?? '').trim();
      const dataNascimentoRaw = String(row['DataNascimento'] ?? '').trim();

      // ── Campos obrigatórios ─────────────────────────────────
      if (!nomeCompleto) { erros.push({ linha, cpfRg, motivo: 'Campo obrigatório ausente: NomeCompleto' }); continue; }
      if (!cpfRg) { erros.push({ linha, cpfRg: '—', motivo: 'Campo obrigatório ausente: CPF_RG' }); continue; }
      if (!dataNascimentoRaw) { erros.push({ linha, cpfRg, motivo: 'Campo obrigatório ausente: DataNascimento' }); continue; }

      // ── Duplicata interna ────────────────────────────────────
      if (cpfRgsNaPlanilha.has(cpfRg)) {
        erros.push({ linha, cpfRg, motivo: 'CPF/RG duplicado na mesma planilha' });
        continue;
      }
      cpfRgsNaPlanilha.add(cpfRg);

      // ── Data de nascimento ───────────────────────────────────
      let dataNascimento: Date;
      try {
        if (dataNascimentoRaw.includes('/')) {
          const [dia, mes, ano] = dataNascimentoRaw.split('/');
          dataNascimento = new Date(`${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`);
        } else {
          dataNascimento = new Date(dataNascimentoRaw);
        }
        if (isNaN(dataNascimento.getTime())) throw new Error();
      } catch {
        erros.push({ linha, cpfRg, motivo: `DataNascimento inválida: "${dataNascimentoRaw}". Use DD/MM/AAAA` });
        continue;
      }

      // ── Normalizar enums ─────────────────────────────────────
      const rTipo = this.normalizarEnum(
        String(row['TipoDeficiencia'] ?? '').trim(),
        this.TIPO_DEFICIENCIA_MAP,
        ['CEGUEIRA_TOTAL', 'BAIXA_VISAO', 'VISAO_MONOCULAR'],
        'TipoDeficiencia',
      );
      if (rTipo.erro) { erros.push({ linha, cpfRg, motivo: rTipo.erro }); continue; }

      const rCausa = this.normalizarEnum(
        String(row['CausaDeficiencia'] ?? '').trim(),
        this.CAUSA_DEFICIENCIA_MAP,
        ['CONGENITA', 'ADQUIRIDA'],
        'CausaDeficiencia',
      );
      if (rCausa.erro) { erros.push({ linha, cpfRg, motivo: rCausa.erro }); continue; }

      const rPref = this.normalizarEnum(
        String(row['PrefAcessibilidade'] ?? '').trim(),
        this.PREF_ACESSIBILIDADE_MAP,
        ['BRAILLE', 'FONTE_AMPLIADA', 'ARQUIVO_DIGITAL', 'AUDIO'],
        'PrefAcessibilidade',
      );
      if (rPref.erro) { erros.push({ linha, cpfRg, motivo: rPref.erro }); continue; }

      // ── Montar registro ──────────────────────────────────────
      validos.push({
        nomeCompleto,
        cpfRg,
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
      });
    }

    if (validos.length === 0) {
      return { importados: 0, ignorados: 0, erros };
    }

    // ── Verificar duplicatas no banco (1 única query) ─────────
    const cpfRgsValidos = validos.map(v => v.cpfRg);
    const existentes = await this.prisma.aluno.findMany({
      where: { cpfRg: { in: cpfRgsValidos } },
      select: { cpfRg: true },
    });
    const cpfRgsExistentes = new Set(existentes.map(e => e.cpfRg));

    const paraInserir: any[] = [];
    let ignorados = 0;

    for (const aluno of validos) {
      if (cpfRgsExistentes.has(aluno.cpfRg)) {
        erros.push({ linha: 0, cpfRg: aluno.cpfRg, motivo: 'CPF/RG já cadastrado no sistema' });
        ignorados++;
      } else {
        paraInserir.push(aluno);
      }
    }

    // ── Inserir em lote ──────────────────────────────────────
    if (paraInserir.length > 0) {
      await this.prisma.aluno.createMany({ data: paraInserir, skipDuplicates: true });
    }

    return { importados: paraInserir.length, ignorados, erros };
  }
}
