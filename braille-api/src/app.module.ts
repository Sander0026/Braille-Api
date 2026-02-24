import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BeneficiariesModule } from './beneficiaries/beneficiaries.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { ComunicadosModule } from './comunicados/comunicados.module';
import { TurmasModule } from './turmas/turmas.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { FrequenciasModule } from './frequencias/frequencias.module';
import { InscricoesModule } from './inscricoes/inscricoes.module';
import { ContatosModule } from './contatos/contatos.module';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    AuthModule,
    UsersModule,
    BeneficiariesModule,
    AppointmentsModule,
    ComunicadosModule,
    TurmasModule, DashboardModule, FrequenciasModule, InscricoesModule, ContatosModule, UploadModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
