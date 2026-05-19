import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RelatorioInstitucionalPdfService } from './exporters/relatorio-institucional-pdf.service';
import { RelatorioInstitucionalXlsxService } from './exporters/relatorio-institucional-xlsx.service';
import { RelatoriosController } from './relatorios.controller';
import { RelatoriosService } from './relatorios.service';

@Module({
  imports: [PrismaModule, AuditLogModule],
  controllers: [RelatoriosController],
  providers: [RelatoriosService, RelatorioInstitucionalPdfService, RelatorioInstitucionalXlsxService],
})
export class RelatoriosModule {}
