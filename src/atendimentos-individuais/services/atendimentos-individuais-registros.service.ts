import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { AuditUser } from '../../common/interfaces/audit-user.interface';
import { CriarAtendimentoIndividualDto } from '../dto/criar-atendimento-individual.dto';
import { AtendimentosIndividuaisService } from './atendimentos-individuais.service';

@Injectable()
export class AtendimentosIndividuaisRegistrosService {
  constructor(private readonly atendimentosService: AtendimentosIndividuaisService) {}

  criar(
    acompanhamentoId: string,
    dto: CriarAtendimentoIndividualDto,
    authUser: AuthenticatedUser | undefined,
    auditUser: AuditUser,
  ) {
    return this.atendimentosService.criarAtendimento(acompanhamentoId, dto, authUser, auditUser);
  }

  listar(acompanhamentoId: string, authUser: AuthenticatedUser | undefined) {
    return this.atendimentosService.listarAtendimentos(acompanhamentoId, authUser);
  }

  buscar(id: string, authUser: AuthenticatedUser | undefined) {
    return this.atendimentosService.buscarAtendimento(id, authUser);
  }
}
