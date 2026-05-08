import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { UploadModule } from '../upload/upload.module';
import { AcompanhamentosIndividuaisController } from './controllers/acompanhamentos-individuais.controller';
import { AtendimentosIndividuaisController } from './controllers/atendimentos-individuais.controller';
import { RelatoriosAtendimentosIndividuaisController } from './controllers/relatorios-atendimentos-individuais.controller';
import { AtendimentosIndividuaisService } from './services/atendimentos-individuais.service';
import { AtendimentosIndividuaisPolicy } from './policies/atendimentos-individuais.policy';

@Module({
  imports: [PrismaModule, AuditLogModule, UploadModule],
  controllers: [
    AcompanhamentosIndividuaisController,
    AtendimentosIndividuaisController,
    RelatoriosAtendimentosIndividuaisController,
  ],
  providers: [AtendimentosIndividuaisService, AtendimentosIndividuaisPolicy],
})
export class AtendimentosIndividuaisModule {}
