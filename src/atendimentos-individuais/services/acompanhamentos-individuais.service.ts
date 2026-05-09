import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { AuditUser } from '../../common/interfaces/audit-user.interface';
import { AtualizarAssuntoAcompanhamentoDto } from '../dto/atualizar-assunto-acompanhamento.dto';
import { CriarAcompanhamentoIndividualDto } from '../dto/criar-acompanhamento-individual.dto';
import { FiltroAcompanhamentoIndividualDto } from '../dto/filtro-acompanhamento-individual.dto';
import { FinalizarAcompanhamentoDto } from '../dto/finalizar-acompanhamento.dto';
import { AtendimentosIndividuaisService } from './atendimentos-individuais.service';

@Injectable()
export class AcompanhamentosIndividuaisService {
  constructor(private readonly atendimentosService: AtendimentosIndividuaisService) {}

  criar(dto: CriarAcompanhamentoIndividualDto, authUser: AuthenticatedUser | undefined, auditUser: AuditUser) {
    return this.atendimentosService.criarAcompanhamento(dto, authUser, auditUser);
  }

  listar(query: FiltroAcompanhamentoIndividualDto, authUser: AuthenticatedUser | undefined) {
    return this.atendimentosService.listarAcompanhamentos(query, authUser);
  }

  buscar(id: string, authUser: AuthenticatedUser | undefined) {
    return this.atendimentosService.buscarAcompanhamento(id, authUser);
  }

  atualizarAssunto(
    id: string,
    dto: AtualizarAssuntoAcompanhamentoDto,
    authUser: AuthenticatedUser | undefined,
    auditUser: AuditUser,
  ) {
    return this.atendimentosService.atualizarAssunto(id, dto, authUser, auditUser);
  }

  finalizar(id: string, dto: FinalizarAcompanhamentoDto, authUser: AuthenticatedUser | undefined, auditUser: AuditUser) {
    return this.atendimentosService.finalizarAcompanhamento(id, dto, authUser, auditUser);
  }

  reabrir(id: string, authUser: AuthenticatedUser | undefined, auditUser: AuditUser) {
    return this.atendimentosService.reabrirAcompanhamento(id, authUser, auditUser);
  }

  arquivar(id: string, authUser: AuthenticatedUser | undefined, auditUser: AuditUser) {
    return this.atendimentosService.arquivarAcompanhamento(id, authUser, auditUser);
  }

  desarquivar(id: string, authUser: AuthenticatedUser | undefined, auditUser: AuditUser) {
    return this.atendimentosService.desarquivarAcompanhamento(id, authUser, auditUser);
  }
}
