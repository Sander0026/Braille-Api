import { Injectable } from '@nestjs/common';
import { CategoriaArquivoAtendimentoIndividual } from '@prisma/client';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { AuditUser } from '../../common/interfaces/audit-user.interface';
import { AtendimentosIndividuaisService } from './atendimentos-individuais.service';

@Injectable()
export class ArquivosAtendimentosIndividuaisService {
  constructor(private readonly atendimentosService: AtendimentosIndividuaisService) {}

  anexar(
    atendimentoId: string,
    file: Express.Multer.File,
    categoria: CategoriaArquivoAtendimentoIndividual,
    authUser: AuthenticatedUser | undefined,
    auditUser: AuditUser,
  ) {
    return this.atendimentosService.anexarArquivo(atendimentoId, file, categoria, authUser, auditUser);
  }

  obterParaDownload(id: string, authUser: AuthenticatedUser | undefined, auditUser: AuditUser) {
    return this.atendimentosService.obterArquivoParaDownload(id, authUser, auditUser);
  }

  arquivar(id: string, motivoExclusao: string | undefined, authUser: AuthenticatedUser | undefined, auditUser: AuditUser) {
    return this.atendimentosService.arquivarArquivoAtendimento(id, motivoExclusao, authUser, auditUser);
  }
}
