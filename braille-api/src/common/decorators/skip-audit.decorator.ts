import { SetMetadata } from '@nestjs/common';

export const SKIP_AUDIT_KEY = 'skipAutomaticAudit';

/**
 * Desativa somente a auditoria automatica do AuditInterceptor.
 * Use em controllers ou rotas que ja registram auditoria manualmente no service.
 */
export const SkipAudit = () => SetMetadata(SKIP_AUDIT_KEY, true);
