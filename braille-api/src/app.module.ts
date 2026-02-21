import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BeneficiariesModule } from './beneficiaries/beneficiaries.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { ComunicadosModule } from './comunicados/comunicados.module';
import { TurmasModule } from './turmas/turmas.module';

@Module({
  imports: [AuthModule, UsersModule, BeneficiariesModule, AppointmentsModule, ComunicadosModule, TurmasModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
