import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { UploadModule } from '../upload/upload.module';
import { AlunoLinhaTempoModule } from '../aluno-linha-tempo/aluno-linha-tempo.module';
import { AcompanhamentosIndividuaisController } from './controllers/acompanhamentos-individuais.controller';
import { AtendimentosIndividuaisController } from './controllers/atendimentos-individuais.controller';
import { RelatoriosAtendimentosIndividuaisController } from './controllers/relatorios-atendimentos-individuais.controller';
import { AtendimentosIndividuaisService } from './services/atendimentos-individuais.service';
import { AcompanhamentosIndividuaisService } from './services/acompanhamentos-individuais.service';
import { AtendimentosIndividuaisRegistrosService } from './services/atendimentos-individuais-registros.service';
import { ArquivosAtendimentosIndividuaisService } from './services/arquivos-atendimentos-individuais.service';
import { RelatoriosAtendimentosIndividuaisService } from './services/relatorios-atendimentos-individuais.service';
import { RelatorioAtendimentoPdfService } from './services/relatorio-atendimento-pdf.service';
import { ArquivoAtendimentoDownloadService } from './services/arquivo-atendimento-download.service';
import { AtendimentosIndividuaisAuditService } from './services/atendimentos-individuais-audit.service';
import { AtendimentosIndividuaisSanitizerService } from './services/atendimentos-individuais-sanitizer.service';
import { AtendimentosIndividuaisPolicy } from './policies/atendimentos-individuais.policy';

@Module({
  imports: [PrismaModule, AuditLogModule, UploadModule, AlunoLinhaTempoModule],
  controllers: [
    AcompanhamentosIndividuaisController,
    AtendimentosIndividuaisController,
    RelatoriosAtendimentosIndividuaisController,
  ],
  providers: [
    AtendimentosIndividuaisService,
    AcompanhamentosIndividuaisService,
    AtendimentosIndividuaisRegistrosService,
    ArquivosAtendimentosIndividuaisService,
    RelatoriosAtendimentosIndividuaisService,
    RelatorioAtendimentoPdfService,
    ArquivoAtendimentoDownloadService,
    AtendimentosIndividuaisAuditService,
    AtendimentosIndividuaisSanitizerService,
    AtendimentosIndividuaisPolicy,
  ],
})
export class AtendimentosIndividuaisModule {}
