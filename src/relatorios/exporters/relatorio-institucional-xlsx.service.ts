import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import type { RelatorioExportacao } from '../relatorios.service';

type CellValue = string | number | boolean | null | undefined;
type SheetRow = Record<string, CellValue>;

@Injectable()
export class RelatorioInstitucionalXlsxService {
  async gerar(relatorio: RelatorioExportacao): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Braille API';
    workbook.created = new Date(relatorio.emitidoEm);

    this.addSheet(workbook, 'Resumo', this.resumoRows(relatorio));
    this.addSheet(
      workbook,
      'Alunos ativos',
      this.alunoRows(relatorio.alunos.data.filter((aluno) => aluno.statusAtivo)),
    );
    this.addSheet(
      workbook,
      'Alunos inativos',
      this.alunoRows(relatorio.alunos.data.filter((aluno) => !aluno.statusAtivo)),
    );
    this.addSheet(workbook, 'Perfil social', this.perfilSocialRows(relatorio));
    this.addSheet(workbook, 'Perfil deficiencia', this.perfilDeficienciaRows(relatorio));
    this.addSheet(workbook, 'Turmas', this.turmaRows(relatorio));
    this.addSheet(workbook, 'Encerramentos', this.encerramentoRows(relatorio));
    this.addSheet(workbook, 'Atendimentos', this.atendimentoRows(relatorio));
    this.addSheet(workbook, 'Frequencias', this.frequenciaRows(relatorio));

    const workbookBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.isBuffer(workbookBuffer) ? workbookBuffer : Buffer.from(workbookBuffer as ArrayBuffer);
  }

  private addSheet(workbook: ExcelJS.Workbook, name: string, rows: SheetRow[]): void {
    const worksheet = workbook.addWorksheet(name);

    if (!rows.length) {
      worksheet.addRow(['Sem dados para os filtros informados']);
      return;
    }

    const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
    worksheet.columns = headers.map((header) => ({
      header,
      key: header,
      width: Math.min(Math.max(header.length + 4, 16), 42),
    }));

    for (const row of rows) {
      worksheet.addRow(row);
    }

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = { vertical: 'middle' };
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };
  }

  private resumoRows(relatorio: RelatorioExportacao): SheetRow[] {
    return [
      { grupo: 'Alunos', indicador: 'Total', valor: relatorio.resumo.alunos.total },
      { grupo: 'Alunos', indicador: 'Ativos', valor: relatorio.resumo.alunos.ativos },
      { grupo: 'Alunos', indicador: 'Inativos', valor: relatorio.resumo.alunos.inativos },
      { grupo: 'Alunos', indicador: 'Novos no periodo', valor: relatorio.resumo.alunos.novosNoPeriodo },
      {
        grupo: 'Alunos',
        indicador: 'Recebem beneficio do governo',
        valor: relatorio.alunos.indicadores.recebemBeneficioGov,
      },
      {
        grupo: 'Alunos',
        indicador: 'Precisam de acompanhante',
        valor: relatorio.alunos.indicadores.precisamAcompanhante,
      },
      { grupo: 'Alunos', indicador: 'Com laudo', valor: relatorio.alunos.indicadores.comLaudo },
      { grupo: 'Alunos', indicador: 'Sem laudo', valor: relatorio.alunos.indicadores.semLaudo },
      { grupo: 'Alunos', indicador: 'Termo LGPD aceito', valor: relatorio.alunos.indicadores.lgpdAceito },
      { grupo: 'Turmas', indicador: 'Total', valor: relatorio.resumo.turmas.total },
      { grupo: 'Turmas', indicador: 'Previstas', valor: relatorio.resumo.turmas.previstas },
      { grupo: 'Turmas', indicador: 'Em andamento', valor: relatorio.resumo.turmas.andamento },
      { grupo: 'Turmas', indicador: 'Concluidas', valor: relatorio.resumo.turmas.concluidas },
      { grupo: 'Turmas', indicador: 'Canceladas', valor: relatorio.resumo.turmas.canceladas },
      { grupo: 'Matriculas', indicador: 'Total', valor: relatorio.resumo.matriculas.total },
      { grupo: 'Matriculas', indicador: 'Ativas', valor: relatorio.resumo.matriculas.ativas },
      { grupo: 'Matriculas', indicador: 'Concluidas', valor: relatorio.resumo.matriculas.concluidas },
      { grupo: 'Matriculas', indicador: 'Evadidas', valor: relatorio.resumo.matriculas.evadidas },
      { grupo: 'Matriculas', indicador: 'Canceladas', valor: relatorio.resumo.matriculas.canceladas },
      { grupo: 'Matriculas', indicador: 'Transferidas', valor: relatorio.resumo.matriculas.transferidas },
      { grupo: 'Indicadores', indicador: 'Taxa de evasao (%)', valor: relatorio.resumo.indicadores.taxaEvasao },
      { grupo: 'Indicadores', indicador: 'Taxa de conclusao (%)', valor: relatorio.resumo.indicadores.taxaConclusao },
      {
        grupo: 'Indicadores',
        indicador: 'Taxa de permanencia (%)',
        valor: relatorio.resumo.indicadores.taxaPermanencia,
      },
    ];
  }

  private alunoRows(alunos: RelatorioExportacao['alunos']['data']): SheetRow[] {
    return alunos.map((aluno) => ({
      id: aluno.id,
      Matricula: aluno.matricula,
      Nome: aluno.nomeCompleto,
      Status: aluno.statusAtivo ? 'ATIVO' : 'INATIVO',
      CPF: aluno.cpf,
      Telefone: aluno.telefoneContato,
      Cidade: aluno.cidade,
      Bairro: aluno.bairro,
      'Tipo de deficiencia': aluno.tipoDeficiencia,
      'Preferencia de acessibilidade': aluno.prefAcessibilidade,
      'Possui laudo': this.simNao(aluno.possuiLaudo || Boolean(aluno.laudoUrl)),
      'Precisa acompanhante': this.simNao(aluno.precisaAcompanhante),
      'Data de cadastro': this.formatarData(aluno.criadoEm),
      Escolaridade: aluno.escolaridade,
      'Renda familiar': aluno.rendaFamiliar,
      'Beneficios governo': aluno.beneficiosGov,
      'Termo LGPD aceito': this.simNao(aluno.termoLgpdAceito),
      matriculas: aluno.matriculasOficina
        .map((matricula) => `${matricula.turma.nome} (${matricula.status})`)
        .join('; '),
    }));
  }

  private perfilSocialRows(relatorio: RelatorioExportacao): SheetRow[] {
    return [
      ...this.resumoAgrupamentoRows('Cidade', relatorio.alunos.indicadores.porCidade),
      ...this.resumoAgrupamentoRows('Bairro', relatorio.alunos.indicadores.porBairro),
      ...this.resumoAgrupamentoRows('Escolaridade', relatorio.alunos.indicadores.porEscolaridade),
      ...this.resumoAgrupamentoRows('Renda familiar', relatorio.alunos.indicadores.porRendaFamiliar),
      {
        perfil: 'Beneficios governo',
        categoria: 'Recebem beneficio',
        total: relatorio.alunos.indicadores.recebemBeneficioGov,
      },
      {
        perfil: 'Acompanhante',
        categoria: 'Precisam de acompanhante',
        total: relatorio.alunos.indicadores.precisamAcompanhante,
      },
    ];
  }

  private perfilDeficienciaRows(relatorio: RelatorioExportacao): SheetRow[] {
    return [
      ...this.resumoAgrupamentoRows('Tipo de deficiencia', relatorio.alunos.indicadores.porTipoDeficiencia),
      ...this.resumoAgrupamentoRows('Causa da deficiencia', relatorio.alunos.indicadores.porCausaDeficiencia),
      ...this.resumoAgrupamentoRows(
        'Preferencia de acessibilidade',
        relatorio.alunos.indicadores.porPreferenciaAcessibilidade,
      ),
      { perfil: 'Laudo', categoria: 'Com laudo', total: relatorio.alunos.indicadores.comLaudo },
      { perfil: 'Laudo', categoria: 'Sem laudo', total: relatorio.alunos.indicadores.semLaudo },
      { perfil: 'LGPD', categoria: 'Termo aceito', total: relatorio.alunos.indicadores.lgpdAceito },
    ];
  }

  private resumoAgrupamentoRows(perfil: string, valores: Record<string, number>): SheetRow[] {
    return Object.entries(valores).map(([categoria, total]) => ({ perfil, categoria, total }));
  }

  private turmaRows(relatorio: RelatorioExportacao): SheetRow[] {
    return relatorio.turmas.data.map((turma) => ({
      id: turma.id,
      'Nome da turma': turma.nome,
      Professor: turma.professor?.nome,
      Status: turma.status,
      Arquivada: this.simNao(!turma.statusAtivo),
      'Data de inicio': this.formatarData(turma.dataInicio),
      'Data de fim': this.formatarData(turma.dataFim),
      'Carga horaria': turma.cargaHoraria,
      'Capacidade maxima': turma.capacidadeMaxima,
      'Total matriculas': turma.metricas.totalMatriculas,
      'Matriculas ativas': turma.metricas.matriculasAtivas,
      Concluidos: turma.metricas.matriculasConcluidas,
      Evadidos: turma.metricas.matriculasEvadidas,
      Cancelados: turma.metricas.matriculasCanceladas,
      Transferidos: turma.metricas.matriculasTransferidas,
      'Taxa de ocupacao (%)': turma.metricas.taxaOcupacao,
      'Taxa de evasao (%)': turma.metricas.taxaEvasao,
      'Taxa de conclusao (%)': turma.metricas.taxaConclusao,
      Frequencias: turma._count.frequencias,
    }));
  }

  private encerramentoRows(relatorio: RelatorioExportacao): SheetRow[] {
    return relatorio.evasoes.data.map((matricula) => ({
      id: matricula.id,
      aluno: matricula.aluno.nomeCompleto,
      matriculaAluno: matricula.aluno.matricula,
      turma: matricula.turma.nome,
      professor: matricula.turma.professor?.nome,
      status: matricula.status,
      motivoEncerramento: matricula.motivoEncerramento,
      observacao: matricula.observacao,
      dataEntrada: this.formatarData(matricula.dataEntrada),
      dataEncerramento: this.formatarData(matricula.dataEncerramento),
      encerradoEm: this.formatarData(matricula.encerradoEm),
      cidade: matricula.aluno.cidade,
      bairro: matricula.aluno.bairro,
      tipoDeficiencia: matricula.aluno.tipoDeficiencia,
    }));
  }

  private atendimentoRows(relatorio: RelatorioExportacao): SheetRow[] {
    return relatorio.atendimentos.data.map((atendimento) => ({
      id: atendimento.id,
      dataAtendimento: this.formatarData(atendimento.dataAtendimento),
      aluno: atendimento.aluno.nomeCompleto,
      matriculaAluno: atendimento.aluno.matricula,
      professor: atendimento.professor.nome,
      tipoRegistro: atendimento.tipoRegistro,
      modalidade: atendimento.modalidade,
      localAtendimento: atendimento.localAtendimento,
      duracaoMinutos: atendimento.duracaoMinutos,
      assunto: atendimento.assuntoDoDia,
      acompanhamento: atendimento.acompanhamento.assuntoAtual,
    }));
  }

  private frequenciaRows(relatorio: RelatorioExportacao): SheetRow[] {
    return relatorio.frequencias.data.map((frequencia) => ({
      id: frequencia.id,
      dataAula: this.formatarData(frequencia.dataAula),
      aluno: frequencia.aluno.nomeCompleto,
      matriculaAluno: frequencia.aluno.matricula,
      turma: frequencia.turma.nome,
      professor: frequencia.turma.professor?.nome,
      status: frequencia.status,
      observacao: frequencia.observacao,
      fechado: frequencia.fechado,
    }));
  }

  private formatarData(value?: Date | string | null): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  }

  private simNao(value: boolean): string {
    return value ? 'Sim' : 'Nao';
  }
}
