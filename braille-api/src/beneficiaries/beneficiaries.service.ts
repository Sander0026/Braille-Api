import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { UpdateBeneficiaryDto } from './dto/update-beneficiary.dto';
import { PrismaService } from '../prisma/prisma.service';
import { QueryBeneficiaryDto } from './dto/query-beneficiary.dto';

@Injectable()
export class BeneficiariesService {
  constructor(private prisma: PrismaService) { }

  async create(createBeneficiaryDto: CreateBeneficiaryDto) {
    const beneficiarioExiste = await this.prisma.aluno.findUnique({
      where: { cpfRg: createBeneficiaryDto.cpfRg }
    });

    if (beneficiarioExiste) {
      throw new ConflictException('Já existe um beneficiário cadastrado com este CPF/RG.');
    }

    const dadosParaSalvar = {
      ...createBeneficiaryDto,
      dataNascimento: new Date(createBeneficiaryDto.dataNascimento)
    };

    return this.prisma.aluno.create({ data: dadosParaSalvar });
  }

  async findAll(query: QueryBeneficiaryDto) {
    const { page = 1, limit = 10, nome, inativos } = query;
    const skip = (page - 1) * limit;

    const whereCondicao: any = { excluido: false };

    if (inativos) {
      whereCondicao.statusAtivo = false;
    } else {
      whereCondicao.statusAtivo = true;
    }

    if (nome) {
      whereCondicao.nomeCompleto = { contains: nome, mode: 'insensitive' };
    }

    const [alunos, total] = await Promise.all([
      this.prisma.aluno.findMany({
        where: whereCondicao,
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
      this.prisma.aluno.count({ where: whereCondicao }),
    ]);

    return {
      data: alunos,
      meta: { total, page, lastPage: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const beneficiario = await this.prisma.aluno.findUnique({
      where: { id },
      include: { matriculas: true }
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
