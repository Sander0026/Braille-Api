import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { FiltroRelatorioAtendimentoDto } from '../dto/filtro-relatorio-atendimento.dto';
import { AtendimentosIndividuaisService } from './atendimentos-individuais.service';

@Injectable()
export class RelatoriosAtendimentosIndividuaisService {
  constructor(private readonly atendimentosService: AtendimentosIndividuaisService) {}

  gerar(query: FiltroRelatorioAtendimentoDto, authUser: AuthenticatedUser | undefined) {
    return this.atendimentosService.gerarRelatorio(query, authUser);
  }

  gerarPdf(query: FiltroRelatorioAtendimentoDto, authUser: AuthenticatedUser | undefined) {
    return this.atendimentosService.gerarRelatorioPdf(query, authUser);
  }
}
