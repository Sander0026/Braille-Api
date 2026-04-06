/**
 * @seeder AlunosSeeder
 *
 * Responsabilidade única: importar alunos de uma planilha Excel (.xlsx) ou CSV.
 *
 * Melhorias em relação ao código original (seed.ts monolítico):
 *   - Zero uso de `require()` inline — imports ESM estáticos no topo do arquivo.
 *   - Zero `any` explícito — tipos fortes `ExcelRow`, `ParsedAluno`, `EnumMap`.
 *   - `normEnum<T>()` genérica — type-safe, sem `as any` no cast de enums.
 *   - Validação de planilha vazia sem duplicação (verificação única).
 *   - Complexidade ciclomática ≤ 15: lógica de iteração extraída para `processarLinha()`.
 *   - Early returns (cláusulas de guarda) em todas as funções.
 *   - Lote de inserção único via `createMany({ skipDuplicates: true })`.
 *   - Deduplicação O(1) via Set em memória — evita N+1 contra o banco.
 */

import { existsSync }  from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import {
  PrismaClient,
  TipoDeficiencia,
  CausaDeficiencia,
  PreferenciaAcessibilidade,
} from '@prisma/client';
import * as ExcelJS from 'exceljs';

// ── Tipos ──────────────────────────────────────────────────────────────────────

/** Uma linha da planilha após extração de cabeçalhos. */
type ExcelRow = Record<string, string | number | Date | boolean | null>;

/** Mapa para normalização de valores de enum vindos da planilha. */
type EnumMap<T extends string> = Record<string, T>;

/** Payload tipado para inserção de aluno no banco. */
interface ParsedAluno {
  nomeCompleto:        string;
  cpf:                 string | null;
  rg:                  string | null;
  dataNascimento:      Date;
  matricula:           string;
  genero:              string | null;
  estadoCivil:         string | null;
  telefoneContato:     string | null;
  email:               string | null;
  cep:                 string | null;
  rua:                 string | null;
  numero:              string | null;
  bairro:              string | null;
  cidade:              string | null;
  uf:                  string | null;
  contatoEmergencia:   string | null;
  escolaridade:        string | null;
  profissao:           string | null;
  rendaFamiliar:       string | null;
  beneficiosGov:       string | null;
  tecAssistivas:       string | null;
  precisaAcompanhante: boolean;
  tipoDeficiencia:     TipoDeficiencia             | null;
  causaDeficiencia:    CausaDeficiencia            | null;
  prefAcessibilidade:  PreferenciaAcessibilidade   | null;
}

/** Contexto de deduplicação passado entre iterações. */
interface DedupContext {
  cpfsRegistrados: Set<string>;
  rgsRegistrados:  Set<string>;
}

/** Resultado do processamento de uma linha. */
type ResultadoLinha =
  | { tipo: 'VAZIO' }
  | { tipo: 'CRITICO'; numeroLinha: number }
  | { tipo: 'DUPLICADO' }
  | { tipo: 'ERRO'; numeroLinha: number; nome: string; motivo: string }
  | { tipo: 'OK'; payload: ParsedAluno };

// ── Constantes de Enum (arrays estáticos — evitam Object.values() com cast) ───

const TIPOS_DEFICIENCIA: readonly TipoDeficiencia[] = [
  TipoDeficiencia.CEGUEIRA_TOTAL,
  TipoDeficiencia.BAIXA_VISAO,
  TipoDeficiencia.VISAO_MONOCULAR,
];

const CAUSAS_DEFICIENCIA: readonly CausaDeficiencia[] = [
  CausaDeficiencia.CONGENITA,
  CausaDeficiencia.ADQUIRIDA,
];

const PREFS_ACESSIBILIDADE: readonly PreferenciaAcessibilidade[] = [
  PreferenciaAcessibilidade.BRAILLE,
  PreferenciaAcessibilidade.FONTE_AMPLIADA,
  PreferenciaAcessibilidade.ARQUIVO_DIGITAL,
  PreferenciaAcessibilidade.AUDIO,
];

// ── Mapas de Normalização de Enum ─────────────────────────────────────────────

const TIPO_DEF_MAP: EnumMap<TipoDeficiencia> = {
  'cegueira total':  TipoDeficiencia.CEGUEIRA_TOTAL,
  cegueira_total:    TipoDeficiencia.CEGUEIRA_TOTAL,
  cegueiratotal:     TipoDeficiencia.CEGUEIRA_TOTAL,
  'baixa visao':     TipoDeficiencia.BAIXA_VISAO,
  baixa_visao:       TipoDeficiencia.BAIXA_VISAO,
  'baixa visão':     TipoDeficiencia.BAIXA_VISAO,
  'visao monocular': TipoDeficiencia.VISAO_MONOCULAR,
  visao_monocular:   TipoDeficiencia.VISAO_MONOCULAR,
  'visão monocular': TipoDeficiencia.VISAO_MONOCULAR,
};

const CAUSA_DEF_MAP: EnumMap<CausaDeficiencia> = {
  congenita:  CausaDeficiencia.CONGENITA,
  congênita:  CausaDeficiencia.CONGENITA,
  congenito:  CausaDeficiencia.CONGENITA,
  adquirida:  CausaDeficiencia.ADQUIRIDA,
  adquirido:  CausaDeficiencia.ADQUIRIDA,
};

const PREF_ACESS_MAP: EnumMap<PreferenciaAcessibilidade> = {
  braille:           PreferenciaAcessibilidade.BRAILLE,
  'fonte ampliada':  PreferenciaAcessibilidade.FONTE_AMPLIADA,
  fonte_ampliada:    PreferenciaAcessibilidade.FONTE_AMPLIADA,
  'arquivo digital': PreferenciaAcessibilidade.ARQUIVO_DIGITAL,
  arquivo_digital:   PreferenciaAcessibilidade.ARQUIVO_DIGITAL,
  audio:             PreferenciaAcessibilidade.AUDIO,
  áudio:             PreferenciaAcessibilidade.AUDIO,
};

// ── Helpers Puros (unitariamente testáveis) ────────────────────────────────────

/**
 * Normaliza um valor de string para um valor de enum válido.
 * Arrays estáticos de valores válidos eliminam Object.values() + cast desnecessário.
 */
function normEnum<T extends string>(
  valor: string,
  mapa: EnumMap<T>,
  validos: readonly T[],
): T | null {
  if (!valor) return null;
  if ((validos as readonly string[]).includes(valor)) return valor as T;
  return mapa[valor.toLowerCase().trim()] ?? null;
}

/**
 * Converte valores heterogêneos do Excel para Date.
 * Suporta: número serial, objeto Date, 'DD/MM/YYYY', 'YYYY-MM-DD'.
 */
function parseExcelDate(raw: string | number | Date | boolean | null): Date | null {
  try {
    let d: Date;

    if (typeof raw === 'number') {
      const epoch = new Date(Date.UTC(1899, 11, 30));
      d = new Date(epoch.getTime() + Math.round(raw) * 86_400_000);
    } else if (raw instanceof Date) {
      d = new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate()));
    } else if (typeof raw === 'string') {
      const s = raw.trim();
      if (s.includes('/')) {
        const [dia, mes, ano] = s.split('/').map(Number);
        d = new Date(Date.UTC(ano, mes - 1, dia));
      } else {
        const [ano, mes, dia] = s.split('-').map(Number);
        d = new Date(Date.UTC(ano, mes - 1, dia));
      }
    } else {
      return null;
    }

    if (Number.isNaN(d.getTime())) return null;

    const ano = d.getUTCFullYear();
    if (ano < 1900 || ano > new Date().getFullYear()) return null;

    return d;
  } catch {
    return null;
  }
}

/**
 * Normaliza uma célula do ExcelJS para um tipo primitivo seguro.
 * ExcelJS retorna células de fórmula como objetos com `.text` ou `.result`.
 * `.result` pode ser qualquer coisa — convertemos para string se não for primitivo.
 */
function normalizarCelula(val: ExcelJS.CellValue): string | number | Date | boolean | null {
  if (val === null || val === undefined)                              return null;
  if (typeof val === 'string' || typeof val === 'number'
      || typeof val === 'boolean' || val instanceof Date)            return val;

  // Objeto ExcelJS RichTextValue → usa .text
  if (typeof val === 'object' && 'text' in val) {
    return (val as { text: string }).text ?? null;
  }

  // Objeto ExcelJS CellFormulaValue → usa .result (pode ser qualquer primitivo)
  if (typeof val === 'object' && 'result' in val) {
    const result = (val as { result: ExcelJS.CellValue }).result;
    if (result === null || result === undefined)                      return null;
    if (typeof result === 'string' || typeof result === 'number'
        || typeof result === 'boolean' || result instanceof Date)    return result;
    // Fallback seguro: converte para string via JSON para evitar '[object Object]'
    return JSON.stringify(result);
  }

  return null;
}

/**
 * Converte uma linha crua do ExcelJS (array indexado) para um objeto chaveado pelos cabeçalhos.
 * Garante que todos os cabeçalhos produzam strings primitivas válidas.
 */
function linhaParaObjeto(rawRow: ExcelJS.CellValue[], headers: string[]): ExcelRow {
  return headers.reduce<ExcelRow>((acc, key, idx) => {
    acc[key] = normalizarCelula(rawRow[idx] ?? null);
    return acc;
  }, {});
}

/**
 * Extrai string segura de um campo da linha — nunca retorna 'undefined' nem '[object Object]'.
 * row[key] é sempre string | number | Date | boolean | null (garantido por normalizarCelula).
 */
function str(row: ExcelRow, key: string): string {
  const val = row[key];
  if (val === null || val === undefined) return '';
  if (val instanceof Date) return val.toISOString();
  return String(val).trim();
}

/**
 * Extrai o cabeçalho de uma célula de cabeçalho do ExcelJS com segurança de tipo.
 * Usa normalizarCelula para evitar '[object Object]' em colunas com rich text.
 */
function extrairCabecalho(cell: ExcelJS.CellValue): string {
  const normalizado = normalizarCelula(cell);
  if (normalizado === null) return '';
  if (normalizado instanceof Date) return normalizado.toISOString();
  return String(normalizado).trim();
}

/** Monta o payload tipado de um aluno para inserção no banco. */
function montarPayload(row: ExcelRow, matricula: string, dataNasc: Date): ParsedAluno {
  return {
    nomeCompleto:        str(row, 'NomeCompleto'),
    cpf:                 str(row, 'CPF')   || str(row, 'CPF_RG') || null,
    rg:                  str(row, 'RG')    || null,
    dataNascimento:      dataNasc,
    matricula,
    genero:              str(row, 'Genero')            || null,
    estadoCivil:         str(row, 'EstadoCivil')        || null,
    telefoneContato:     str(row, 'Telefone')           || null,
    email:               str(row, 'Email')              || null,
    cep:                 str(row, 'CEP')                || null,
    rua:                 str(row, 'Rua')                || null,
    numero:              str(row, 'Numero')             || null,
    bairro:              str(row, 'Bairro')             || null,
    cidade:              str(row, 'Cidade')             || null,
    uf:                  str(row, 'UF')                 || null,
    contatoEmergencia:   str(row, 'ContatoEmergencia')  || null,
    escolaridade:        str(row, 'Escolaridade')       || null,
    profissao:           str(row, 'Profissao')          || null,
    rendaFamiliar:       str(row, 'RendaFamiliar')      || null,
    beneficiosGov:       str(row, 'BeneficiosGov')      || null,
    tecAssistivas:       str(row, 'TecAssistivas')      || null,
    precisaAcompanhante: str(row, 'PrecisaAcompanhante').toUpperCase() === 'SIM',
    tipoDeficiencia:     normEnum(str(row, 'TipoDeficiencia'),    TIPO_DEF_MAP,    TIPOS_DEFICIENCIA),
    causaDeficiencia:    normEnum(str(row, 'CausaDeficiencia'),   CAUSA_DEF_MAP,   CAUSAS_DEFICIENCIA),
    prefAcessibilidade:  normEnum(str(row, 'PrefAcessibilidade'), PREF_ACESS_MAP,  PREFS_ACESSIBILIDADE),
  };
}

/**
 * Processa UMA linha da planilha.
 * Extraída para reduzir a Complexidade Cognitiva de `importarAlunos` (SonarQube ≤ 15).
 * Retorna um resultado discriminado sem efeitos colaterais (puro).
 */
function processarLinha(
  rawRow:        ExcelJS.CellValue[],
  headers:       string[],
  numeroLinha:   number,
  ano:           number,
  sequencial:    number,
  dedup:         DedupContext,
): ResultadoLinha {
  const row      = linhaParaObjeto(rawRow, headers);
  const nome     = str(row, 'NomeCompleto');
  const cpf      = str(row, 'CPF') || str(row, 'CPF_RG') || null;
  const rg       = str(row, 'RG') || null;
  const dataNasc = parseExcelDate(row['DataNascimento'] as string | number | Date | null);

  // Cláusulas de guarda — early returns por prioridade
  if (!nome && !cpf && !rg)             return { tipo: 'VAZIO' };
  if (!nome || (!cpf && !rg) || !dataNasc) return { tipo: 'CRITICO', numeroLinha };

  const isDuplicado =
    (cpf != null && dedup.cpfsRegistrados.has(cpf)) ||
    (rg  != null && dedup.rgsRegistrados.has(rg));

  if (isDuplicado) return { tipo: 'DUPLICADO' };

  // Registra no cache para detectar duplicatas dentro da própria planilha
  if (cpf) dedup.cpfsRegistrados.add(cpf);
  if (rg)  dedup.rgsRegistrados.add(rg);

  try {
    const matricula = `${ano}${String(sequencial).padStart(5, '0')}`;
    const payload   = montarPayload(row, matricula, dataNasc);
    return { tipo: 'OK', payload };
  } catch (err: unknown) {
    const motivo = err instanceof Error ? err.message.substring(0, 120) : JSON.stringify(err);
    return { tipo: 'ERRO', numeroLinha, nome, motivo };
  }
}

// ── Função Principal (Complexidade Cognitiva: ≤ 10 após extração) ─────────────

export async function importarAlunos(prisma: PrismaClient, csvEnv: string): Promise<void> {
  const filePath = isAbsolute(csvEnv)
    ? csvEnv
    : resolve(process.cwd(), 'prisma', csvEnv);

  if (!existsSync(filePath)) {
    console.warn(`⚠️  [AlunosSeeder] Arquivo não encontrado: ${filePath}`);
    return;
  }

  console.log(`📂 [AlunosSeeder] Lendo planilha: ${filePath}`);

  const workbook = new ExcelJS.Workbook();
  if (filePath.endsWith('.csv')) {
    await workbook.csv.readFile(filePath);
  } else {
    await workbook.xlsx.readFile(filePath);
  }

  const worksheet = workbook.worksheets[0];

  if (!worksheet || worksheet.rowCount < 3) {
    console.warn('⚠️  [AlunosSeeder] Planilha vazia (mínimo: linha de título + cabeçalhos + 1 dado).');
    return;
  }

  // Lê linhas brutas, removendo o índice 0 vazio do ExcelJS
  const rawRows: ExcelJS.CellValue[][] = [];
  worksheet.eachRow((row) => {
    rawRows.push((row.values as ExcelJS.CellValue[]).slice(1));
  });

  // Linha 0 = título/descrição, Linha 1 = cabeçalhos, Linha 2+ = dados
  const headers = rawRows[1].map(extrairCabecalho);
  const dataRows = rawRows.slice(2);

  // ── Coleta de chaves primárias para deduplicação em memória (O(1) — evita N+1) ─
  const allCpfs = dataRows.map((r) => {
    const row = linhaParaObjeto(r, headers);
    return str(row, 'CPF') || str(row, 'CPF_RG');
  }).filter(Boolean);

  const allRgs = dataRows
    .map((r) => str(linhaParaObjeto(r, headers), 'RG'))
    .filter(Boolean);

  // ── 2 queries em paralelo — O(1) em round-trips ───────────────────────────
  const [existentes, baseCount] = await Promise.all([
    prisma.aluno.findMany({
      where: { OR: [{ cpf: { in: allCpfs } }, { rg: { in: allRgs } }] },
      select: { cpf: true, rg: true },
    }),
    prisma.aluno.count({
      where: { matricula: { startsWith: `${new Date().getFullYear()}` } },
    }),
  ]);

  const dedup: DedupContext = {
    cpfsRegistrados: new Set(existentes.map((a) => a.cpf).filter((v): v is string => v !== null)),
    rgsRegistrados:  new Set(existentes.map((a) => a.rg).filter((v): v is string => v !== null)),
  };

  const ano       = new Date().getFullYear();
  let sequencial  = baseCount + 1;
  let importados  = 0;
  let ignorados   = 0;
  let erros       = 0;

  const alunosParaInserir: ParsedAluno[] = [];

  // ── Iteração com complexidade plana — lógica pesada em processarLinha() ───
  for (let i = 0; i < dataRows.length; i++) {
    const resultado = processarLinha(dataRows[i], headers, i + 3, ano, sequencial, dedup);

    switch (resultado.tipo) {
      case 'VAZIO':    continue;
      case 'DUPLICADO': ignorados++; continue;
      case 'CRITICO':
        erros++;
        console.warn(`  ⚠️  [AlunosSeeder] Linha ${resultado.numeroLinha}: dados obrigatórios ausentes.`);
        continue;
      case 'ERRO':
        erros++;
        console.error(`  ❌ [AlunosSeeder] Linha ${resultado.numeroLinha} (${resultado.nome}): ${resultado.motivo}`);
        continue;
      case 'OK':
        alunosParaInserir.push(resultado.payload);
        sequencial++;
        break;
    }
  }

  // ── Inserção lote atômico ─────────────────────────────────────────────────
  if (alunosParaInserir.length > 0) {
    console.log(`🚀 [AlunosSeeder] Inserindo lote de ${alunosParaInserir.length} aluno(s)...`);
    const resultado = await prisma.aluno.createMany({
      data: alunosParaInserir,
      skipDuplicates: true,
    });
    importados = resultado.count;
  }

  console.log(
    `📋 [AlunosSeeder] Resumo: ${importados} inseridos | ${ignorados} já existentes (pulados) | ${erros} com erro.`,
  );
}
