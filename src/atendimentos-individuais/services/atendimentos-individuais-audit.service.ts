import { Injectable, Logger } from '@nestjs/common';
import { AuditAcao } from '@prisma/client';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AuditUser } from '../../common/interfaces/audit-user.interface';

@Injectable()
export class AtendimentosIndividuaisAuditService {
  private readonly logger = new Logger(AtendimentosIndividuaisAuditService.name);

  constructor(private readonly auditService: AuditLogService) {}

  registrar(
    entidade: string,
    registroId: string,
    acao: AuditAcao,
    auditUser: AuditUser,
    oldValue?: unknown,
    newValue?: unknown,
  ): void {
    this.auditService
      .registrar({
        entidade,
        registroId,
        acao,
        autorId: auditUser.sub,
        autorNome: auditUser.nome,
        autorRole: auditUser.role,
        ip: auditUser.ip,
        userAgent: auditUser.userAgent,
        oldValue,
        newValue,
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : JSON.stringify(error);
        this.logger.warn(`Falha na auditoria de ${entidade}/${registroId}: ${message}`);
      });
  }
}
