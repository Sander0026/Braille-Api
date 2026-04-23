/**
 * Utilitário Financeiro e de Tempo
 *
 * Contém funções para manipulação avançada de datas, incluindo cálculo
 * de carga horária baseado em dias da semana e intervalos de dias corridos.
 */

import { DiaSemana } from '@prisma/client';

export interface GradeHorariaInput {
  dia: DiaSemana;
  horaInicio: number; // minutos desde a meia-noite
  horaFim: number;
}

/**
 * Mapeamento de `DiaSemana` do Prisma para o `getDay()` nativo do Date do JS
 * 0 = Domingo, 1 = Segunda, 2 = Terça, 3 = Quarta, 4 = Quinta, 5 = Sexta, 6 = Sábado
 */
const DIAS_PARA_JS: Record<DiaSemana, number> = {
  [DiaSemana.DOM]: 0,
  [DiaSemana.SEG]: 1,
  [DiaSemana.TER]: 2,
  [DiaSemana.QUA]: 3,
  [DiaSemana.QUI]: 4,
  [DiaSemana.SEX]: 5,
  [DiaSemana.SAB]: 6,
};

/**
 * Calcula a Carga Horária total (em horas) com base em um intervalo
 * de datas e uma grade horária semanal.
 *
 * O algoritmo itera dia a dia entre a `dataInicio` e `dataFim` (inclusive),
 * verificando se o dia da semana atual consta na `gradeHoraria`.
 * Se constar, adiciona a duração daquele turno (horaFim - horaInicio) ao total.
 *
 * @param dataInicio Data de início real da turma (ex: 2026-03-01)
 * @param dataFim Data de fim real da turma (ex: 2026-03-31)
 * @param gradeHoraria Array de turnos cadastrados
 * @returns string formatada (ex: "40 horas" ou "2 horas e 30 minutos")
 */
export function calcularCargaHorariaTotal(dataInicio: Date, dataFim: Date, gradeHoraria: GradeHorariaInput[]): string {
  if (!dataInicio || !dataFim || !gradeHoraria || gradeHoraria.length === 0) {
    return '0 horas';
  }

  // Clona para evitar mutação da data original e remove a parte da hora (UTC handling)
  // Usamos as referências setHours(0,0,0,0) para iterar perfeitamente os dias soltos.
  const cur = new Date(dataInicio);
  cur.setHours(0, 0, 0, 0);

  const end = new Date(dataFim);
  end.setHours(0, 0, 0, 0);

  // Se a data Fim é anterior ao Início (caso inconsistente submetido pelo front), aborta.
  if (end < cur) {
    return '0 horas';
  }

  // Pre-processa a grade para facilitar a busca (Agrupa minutos totais por dia da semana do JS)
  // Como pode haver mais de um turno no mesmo dia (ex: Manhã e Tarde), somamos o total diário.
  const minutosPorDiaJs = new Map<number, number>();

  for (const turno of gradeHoraria) {
    const jsDay = DIAS_PARA_JS[turno.dia];
    const duracao = turno.horaFim - turno.horaInicio;

    // Se a duração for negativa ou zero (horário invertido), ignora este turno
    if (duracao > 0) {
      const acumulado = minutosPorDiaJs.get(jsDay) || 0;
      minutosPorDiaJs.set(jsDay, acumulado + duracao);
    }
  }

  let totalMinutos = 0;

  // Itera dia a dia (Cur <= End)
  while (cur <= end) {
    const curDiaDaSemanaJs = cur.getDay(); // 0 a 6

    // Se esse dia da semana existe na grade horária, adicione os minutos correspondentes
    if (minutosPorDiaJs.has(curDiaDaSemanaJs)) {
      totalMinutos += minutosPorDiaJs.get(curDiaDaSemanaJs) || 0;
    }

    // Avança 1 dia (+24 horas)
    cur.setDate(cur.getDate() + 1);
  }

  if (totalMinutos === 0) return '0 horas';

  const horas = Math.floor(totalMinutos / 60);
  const minutosRestantes = totalMinutos % 60;

  if (horas === 0) {
    return `${minutosRestantes} minuto${minutosRestantes === 1 ? '' : 's'}`;
  } else if (minutosRestantes === 0) {
    return `${horas} hora${horas === 1 ? '' : 's'}`;
  } else {
    return `${horas} hora${horas === 1 ? '' : 's'} e ${minutosRestantes} minuto${minutosRestantes === 1 ? '' : 's'}`;
  }
}

// ── Helpers de Formatação para Certificados ─────────────────────────────────

/**
 * Formata uma string ISO 8601 para o formato brasileiro DD/MM/AAAA
 * **sem deslocamento de fuso horário** (evita o bug de datas voltando 1 dia).
 *
 * É segura para datas vindas do banco (ISO com 'T') e strings simples 'YYYY-MM-DD'.
 *
 * @example
 *   formatarDataBR('2026-03-27T00:00:00.000Z') // '27/03/2026'
 *   formatarDataBR('2026-03-27')               // '27/03/2026'
 */
export function formatarDataBR(isoStr: string): string {
  const partes = isoStr.split('T')[0].split('-');
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  // Fallback: se formato inesperado, usa Intl com timezone explícito
  return new Date(isoStr).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/** Variáveis disponíveis para substituição num template de certificado. */
export interface TemplateVars {
  nomeDestinatario: string;
  motivo: string;
  dataEmissao: string; // já formatado em DD/MM/AAAA
}

/**
 * Preenche as tags de template `{{TAG}}` com os valores fornecidos.
 *
 * Suporta múltiplas variações de nome por compatibilidade com templates legados.
 * Centraliza a lógica — elimina as 18 linhas de replaceAll duplicadas no service.
 */
export function preencherTemplateTexto(template: string, vars: TemplateVars): string {
  return template
    .replaceAll('{{ALUNO}}', vars.nomeDestinatario)
    .replaceAll('{{NOME}}', vars.nomeDestinatario)
    .replaceAll('{{APOIADOR}}', vars.nomeDestinatario)
    .replaceAll('{{PARCEIRO}}', vars.nomeDestinatario)
    .replaceAll('{{NOME_APOIADOR}}', vars.nomeDestinatario)
    .replaceAll('{{MOTIVO}}', vars.motivo)
    .replaceAll('{{DATA_EMISSAO}}', vars.dataEmissao)
    .replaceAll('{{DATA_EVENTO}}', vars.dataEmissao)
    .replaceAll('{{DATA}}', vars.dataEmissao);
}
