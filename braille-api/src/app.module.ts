import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BeneficiariesModule } from './beneficiaries/beneficiaries.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { ComunicadosModule } from './comunicados/comunicados.module';
import { TurmasModule } from './turmas/turmas.module';
import { UploadsModule } from './uploads/uploads.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    AuthModule, 
    UsersModule, 
    BeneficiariesModule, 
    AppointmentsModule, 
    ComunicadosModule, 
    TurmasModule, UploadsModule, DashboardModule,  
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
