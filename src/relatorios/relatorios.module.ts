import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RelatorioInstitucionalPdfService } from './exporters/relatorio-institucional-pdf.service';
import { RelatorioInstitucionalXlsxService } from './exporters/relatorio-institucional-xlsx.service';
import { RelatoriosController } from './relatorios.controller';
import { RelatoriosService } from './relatorios.service';

@Module({
  imports: [PrismaModule],
  controllers: [RelatoriosController],
  providers: [RelatoriosService, RelatorioInstitucionalPdfService, RelatorioInstitucionalXlsxService],
})
export class RelatoriosModule {}
