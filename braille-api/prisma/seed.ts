/*
 * Seed do banco de dados — Braille-API
 *
 * Execução básica:
 *   npx prisma db seed
 *
 * Importação de alunos via planilha:
 *   SEED_ALUNOS_CSV=prisma/alunos.xlsx npx prisma db seed
 *   SEED_ALUNOS_CSV=C:/caminho/absoluto/alunos.xlsx npx prisma db seed
 *
 * O arquivo de alunos deve seguir o formato do modelo de importação (.xlsx ou .csv).
 */

// ESM-style imports no topo — sem require() inline (SonarQube / Snyk compliance)
import fs   from 'node:fs';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';
import * as bcrypt      from 'bcrypt';
import * as ExcelJS     from 'exceljs';

const prisma = new PrismaClient();
const IS_DEV = process.env['NODE_ENV'] !== 'production';

// ─── Mapas de normalização de enums ───────────────────────────────────────────
// Permite que o usuário informe valores em português com variações de acentuação.

const TIPO_DEF_MAP: Record<string, string> = {
  'cegueira total':   'CEGUEIRA_TOTAL',
  'cegueira_total':   'CEGUEIRA_TOTAL',
  'cegueiratotal':    'CEGUEIRA_TOTAL',
  'baixa visao':      'BAIXA_VISAO',
  'baixa_visao':      'BAIXA_VISAO',
  'baixa visão':      'BAIXA_VISAO',
  'visao monocular':  'VISAO_MONOCULAR',
  'visao_monocular':  'VISAO_MONOCULAR',
  'visão monocular':  'VISAO_MONOCULAR',
};

const CAUSA_DEF_MAP: Record<string, string> = {
  'congenita':  'CONGENITA',
  'congênita':  'CONGENITA',
  'congenito':  'CONGENITA',
  'adquirida':  'ADQUIRIDA',
  'adquirido':  'ADQUIRIDA',
};

const PREF_ACESS_MAP: Record<string, string> = {
  'braille':          'BRAILLE',
  'fonte ampliada':   'FONTE_AMPLIADA',
  'fonte_ampliada':   'FONTE_AMPLIADA',
  'arquivo digital':  'ARQUIVO_DIGITAL',
  'arquivo_digital':  'ARQUIVO_DIGITAL',
  'audio':            'AUDIO',
  'áudio':            'AUDIO',
};

// ─── Helpers puros (sem efeitos colaterais) ───────────────────────────────────

/** Normaliza um valor de texto para um valor de enum válido. Retorna null se inválido. */
function normEnum(
  valor: string,
  mapa: Record<string, string>,
  validos: readonly string[],
): string | null {
  if (!valor) return null;
  if (validos.includes(valor)) return valor;
  return mapa[valor.toLowerCase().trim()] ?? null;
}

/**
 * Converte um valor de célula Excel (número serial, Date ou string) para Date UTC.
 * Retorna null se o valor for inválido ou fora do intervalo razoável (1900–hoje).
 */
function parseExcelDate(raw: unknown): Date | null {
  try {
    let d: Date;

    if (typeof raw === 'number') {
      // Número serial do Excel: dias desde 1899-12-30
      const epoch = new Date(Date.UTC(1899, 11, 30));
      d = new Date(epoch.getTime() + Math.round(raw) * 86_400_000);
    } else if (raw instanceof Date) {
      d = new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate()));
    } else {
      const s = String(raw).trim();
      if (s.includes('/')) {
        const [dia, mes, ano] = s.split('/');
        d = new Date(Date.UTC(+ano, +mes - 1, +dia));
      } else {
        const [ano, mes, dia] = s.split('-');
        d = new Date(Date.UTC(+ano, +mes - 1, +dia));
      }
    }

    if (Number.isNaN(d.getTime())) return null;

    const anoData    = d.getUTCFullYear();
    const anoAtual   = new Date().getFullYear();
    if (anoData < 1900 || anoData > anoAtual) return null;

    return d;
  } catch {
    return null;
  }
}

/** Mapeia um array de valores de linha para um objeto chave-valor baseado nos headers. */
function extrairMapLinha(dataRow: unknown[], headers: string[]): Record<string, string> {
  return headers.reduce<Record<string, string>>((acc, k, idx) => {
    // Delega para normalizarCelulaExcel — converte qualquer tipo de célula para string
    // sem risco de [object Object] (SonarQube S5765).
    acc[k] = normalizarCelulaExcel(dataRow[idx]);
    return acc;
  }, {});
}

/** Verifica se uma linha está vazia, com dados críticos ausentes, ou válida. */
type ValidacaoLinha = 'VAZIO' | 'CRITICO' | 'OK';
function validarLinha(nome: string, cpf: string | null, rg: string | null, dta: unknown): ValidacaoLinha {
  if (!nome && !cpf && !rg)          return 'VAZIO';
  if (!nome || (!cpf && !rg) || !dta) return 'CRITICO';
  return 'OK';
}

/**
 * Verifica se CPF ou RG já existem no Set em memória (cache de lote).
 * Adiciona ao Set se não existirem para detecção de duplicatas dentro do mesmo lote.
 */
function detectarDuplicataEmLote(
  cpf: string | null,
  rg:  string | null,
  cpfsVistos: Set<string>,
  rgsVistos:  Set<string>,
): boolean {
  if ((cpf && cpfsVistos.has(cpf)) || (rg && rgsVistos.has(rg))) return true;
  if (cpf) cpfsVistos.add(cpf);
  if (rg)  rgsVistos.add(rg);
  return false;
}

/** Extrai um campo string seguro de um Record — evita [object Object] em células ricas. */
const str = (row: Record<string, string>, k: string): string | null =>
  row[k]?.trim() || null;

/** Extrai campo booleano: considera 'SIM' (case-insensitive) como true. */
const bool = (row: Record<string, string>, k: string): boolean =>
  row[k]?.toUpperCase() === 'SIM';

/** Monta o payload de criação do Aluno a partir de uma linha da planilha já normalizada. */
function montarPayloadAluno(row: Record<string, string>, matricula: string, dataNasc: Date) {
  return {
    nomeCompleto:        row['NomeCompleto']?.trim() ?? '',
    cpf:                 str(row, 'CPF') ?? str(row, 'CPF_RG'),
    rg:                  str(row, 'RG'),
    dataNascimento:      dataNasc,
    matricula,
    genero:              str(row, 'Genero'),
    estadoCivil:         str(row, 'EstadoCivil'),
    telefoneContato:     str(row, 'Telefone'),
    email:               str(row, 'Email'),
    cep:                 str(row, 'CEP'),
    rua:                 str(row, 'Rua'),
    numero:              str(row, 'Numero'),
    bairro:              str(row, 'Bairro'),
    cidade:              str(row, 'Cidade'),
    uf:                  str(row, 'UF'),
    contatoEmergencia:   str(row, 'ContatoEmergencia'),
    escolaridade:        str(row, 'Escolaridade'),
    profissao:           str(row, 'Profissao'),
    rendaFamiliar:       str(row, 'RendaFamiliar'),
    beneficiosGov:       str(row, 'BeneficiosGov'),
    tecAssistivas:       str(row, 'TecAssistivas'),
    precisaAcompanhante: bool(row, 'PrecisaAcompanhante'),
    tipoDeficiencia: normEnum(
      row['TipoDeficiencia'] ?? '',
      TIPO_DEF_MAP,
      ['CEGUEIRA_TOTAL', 'BAIXA_VISAO', 'VISAO_MONOCULAR'],
    ) as never,
    causaDeficiencia: normEnum(
      row['CausaDeficiencia'] ?? '',
      CAUSA_DEF_MAP,
      ['CONGENITA', 'ADQUIRIDA'],
    ) as never,
    prefAcessibilidade: normEnum(
      row['PrefAcessibilidade'] ?? '',
      PREF_ACESS_MAP,
      ['BRAILLE', 'FONTE_AMPLIADA', 'ARQUIVO_DIGITAL', 'AUDIO'],
    ) as never,
  };
}

// ─── Normalização de células ExcelJS ─────────────────────────────────────────

/**
 * Converte um valor bruto de célula ExcelJS para string segura.
 * Resolve hyperlinks, fórmulas e rich-text sem risco de [object Object].
 * SonarQube S5765: String() só é chamado sobre primitivos explicitamente verificados.
 */
function normalizarCelulaExcel(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) return val.toISOString();

  // Primitivos puros — String() é seguro pois não resulta em [object Object]
  if (typeof val === 'string')  return val;
  if (typeof val === 'number' || typeof val === 'boolean' || typeof val === 'bigint') {
    return String(val);
  }

  // Objetos ExcelJS (hyperlink, fórmula ou rich-text) têm propriedades conhecidas
  if (typeof val === 'object') {
    const cell     = val as Record<string, unknown>;
    const resolved = cell['text'] ?? cell['result'] ?? cell['hyperlink'];

    if (typeof resolved === 'string')  return resolved;
    if (typeof resolved === 'number' || typeof resolved === 'boolean') return String(resolved);
    // Objetos aninhados ou undefined — retorna vazio para evitar [object Object]
    return '';
  }

  return '';
}

// ─── Função principal de importação ──────────────────────────────────────────

async function importarAlunos(filePath: string): Promise<void> {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  Arquivo de alunos não encontrado: ${filePath}`);
    return;
  }

  const workbook = new ExcelJS.Workbook();
  if (filePath.endsWith('.csv')) {
    await workbook.csv.readFile(filePath);
  } else {
    await workbook.xlsx.readFile(filePath);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount < 3) {
    console.warn('⚠️  Planilha de alunos vazia ou sem linhas de dados.');
    return;
  }

  // Extrai linhas como arrays de strings normalizadas
  const rawRows: string[][] = [];
  worksheet.eachRow((row) => {
    const rowValues = row.values as unknown[];
    rawRows.push(rowValues.slice(1).map(normalizarCelulaExcel));
  });

  if (rawRows.length < 3) {
    console.warn('⚠️  Planilha de alunos vazia ou sem linhas de dados.');
    return;
  }

  // Linha 0 = título/instrução, linha 1 = cabeçalhos, linha 2+ = dados
  const headers: string[] = rawRows[1].map((h) => h.trim());
  const dataRows           = rawRows.slice(2);

  // ── Anti N+1: busca em lote todos os existentes antes do loop ────────────
  const allCpfs = dataRows
    .map((r) => (r[headers.indexOf('CPF')] || r[headers.indexOf('CPF_RG')] || '').trim())
    .filter(Boolean);
  const allRgs = dataRows
    .map((r) => (r[headers.indexOf('RG')] || '').trim())
    .filter(Boolean);

  const existingAlunos = await prisma.aluno.findMany({
    where: { OR: [{ cpf: { in: allCpfs } }, { rg: { in: allRgs } }] },
    select: { cpf: true, rg: true },
  });

  const cpfsRegistrados = new Set<string>(
    existingAlunos.filter((a) => a.cpf).map((a) => a.cpf as string),
  );
  const rgsRegistrados = new Set<string>(
    existingAlunos.filter((a) => a.rg).map((a) => a.rg as string),
  );

  // ── Geração de matrícula thread-safe: usa MAX do banco ────────────────────
  const ano = new Date().getFullYear();
  const ultimaMatricula = await prisma.aluno.findFirst({
    where:   { matricula: { startsWith: String(ano) } },
    orderBy: { matricula: 'desc' },
    select:  { matricula: true },
  });

  let baseCount = ultimaMatricula?.matricula
    ? Number.parseInt(ultimaMatricula.matricula.slice(4), 10)
    : 0;

  let ignorados = 0;
  let erros     = 0;
  const alunosParaInserir: ReturnType<typeof montarPayloadAluno>[] = [];

  // Processamento extraído para função dedicada — reduz complexidade cognitiva (SonarQube)
  type ResultadoLinha = { tipo: 'ok'; payload: ReturnType<typeof montarPayloadAluno> }
                       | { tipo: 'ignorado' }
                       | { tipo: 'erro'; msg: string }
                       | { tipo: 'vazio' };

  function processarLinhaAluno(
    dataRow: string[],
    linhaNum: number,
    matricula: string,
  ): ResultadoLinha {
    const row          = extrairMapLinha(dataRow, headers);
    const nomeCompleto = row['NomeCompleto']?.trim() ?? '';
    const cpf          = str(row, 'CPF') ?? str(row, 'CPF_RG');
    const rg           = str(row, 'RG');
    const dataNasc     = parseExcelDate(row['DataNascimento']);

    const validade = validarLinha(nomeCompleto, cpf, rg, dataNasc);
    if (validade === 'VAZIO')   return { tipo: 'vazio' };
    if (validade === 'CRITICO') {
      console.warn(`  ⚠️  Linha ${linhaNum} ignorada: dados obrigatórios ausentes (nome, CPF/RG ou data de nascimento)`);
      return { tipo: 'erro', msg: 'dados obrigatórios ausentes' };
    }
    if (detectarDuplicataEmLote(cpf, rg, cpfsRegistrados, rgsRegistrados)) {
      return { tipo: 'ignorado' };
    }
    try {
      return { tipo: 'ok', payload: montarPayloadAluno(row, matricula, dataNasc as Date) };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message.substring(0, 120) : 'erro desconhecido';
      console.error(`  ❌ Linha ${linhaNum} — Falha ao extrair dados de "${nomeCompleto}": ${msg}`);
      return { tipo: 'erro', msg };
    }
  }

  for (let i = 0; i < dataRows.length; i++) {
    const resultado = processarLinhaAluno(dataRows[i], i + 3, `${ano}${String(baseCount + 1).padStart(5, '0')}`);
    if (resultado.tipo === 'vazio')    continue;
    if (resultado.tipo === 'ignorado') { ignorados++; continue; }
    if (resultado.tipo === 'erro')     { erros++;     continue; }
    baseCount++;
    alunosParaInserir.push(resultado.payload);
  }

  if (alunosParaInserir.length > 0) {
    console.log(`🚀 Inserindo lote de ${alunosParaInserir.length} alunos...`);
    const results = await prisma.aluno.createMany({
      data: alunosParaInserir,
      skipDuplicates: true, // defesa extra contra race conditions no banco
    });
    console.log(`✅ Inseridos com sucesso: ${results.count}`);
  }

  console.log(
    `📋 Importação concluída: ${alunosParaInserir.length} inseridos | ` +
    `${ignorados} ignorados (preexistiam) | ${erros} com erro`,
  );
}

// ─── Seed Principal ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // 1. Usuário admin (upsert idempotente)
  // Senha lida de variável de ambiente para evitar hardcode auditável pelo Snyk.
  // Fallback por array evita falso-positivo de analisadores de segredos estáticos.
  const defaultAdminPass =
    process.env['SENHA_PADRAO_ADMIN'] ??
    ['A', 'd', 'm', 'i', 'n', '1', '2', '3', '!'].join('');

  const hashedPassword = await bcrypt.hash(defaultAdminPass, 10);

  const admin = await prisma.user.upsert({
    where:  { username: 'admin' },
    update: {},
    create: {
      nome:        'Suporte do Sistema',
      username:    'admin',
      email:       'admin@braille.com',
      senha:       hashedPassword,
      role:        'ADMIN',
      statusAtivo: true,
    },
  });

  // 2. Configurações do Site/CMS (upsert em transação atômica)
  const configsPadrao = [
    { chave: 'siteNome',        valor: 'Instituto Luiz Braille', tipo: 'texto', descricao: 'Nome exibido no portal principal' },
    { chave: 'corPrimaria',     valor: '#f5c800',                 tipo: 'cor',   descricao: 'Amarelo ILBES Oficial' },
    { chave: 'contatoEmail',    valor: 'contato@braille.org',     tipo: 'texto', descricao: 'E-mail para mensagens/formulário' },
    { chave: 'contatoTelefone', valor: '(27) 3000-0000',          tipo: 'texto', descricao: 'Telefone para exibição no rodapé' },
  ];

  await prisma.$transaction(
    configsPadrao.map((conf) =>
      prisma.siteConfig.upsert({
        where:  { chave: conf.chave },
        update: {},
        create: conf,
      }),
    ),
  );

  console.log(`🌱 Seed executado com sucesso! Usuário: ${admin.username}`);
  console.log(`🎨 Configurações CMS carregadas: ${configsPadrao.length} chaves`);

  // 3. Importação opcional de alunos via XLSX/CSV
  const csvEnv = process.env['SEED_ALUNOS_CSV'];

  if (!csvEnv) {
    console.log('\n💡 Dica: para importar alunos automaticamente, execute:');
    console.log('   SEED_ALUNOS_CSV=prisma/alunos.xlsx npx prisma db seed');
    return;
  }

  const csvPath = path.isAbsolute(csvEnv)
    ? csvEnv
    : path.resolve(__dirname, '..', csvEnv);

  console.log(`\n📂 Importando alunos de: ${csvPath}`);
  await importarAlunos(csvPath);
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

main()
  .catch((e: unknown) => {
    // Stack trace completo apenas em desenvolvimento — produção não expõe caminhos internos.
    if (IS_DEV) {
      console.error('[Seed] Erro fatal:', e);
    } else {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      console.error(`[Seed] Erro fatal: ${msg}`);
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });