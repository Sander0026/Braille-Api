import { Module } from '@nestjs/common';
import { LaudosService } from './laudos.service';
import { LaudosController } from './laudos.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [PrismaModule, UploadModule],
  controllers: [LaudosController],
  providers: [LaudosService],
  exports: [LaudosService],
})
export class LaudosModule {}
