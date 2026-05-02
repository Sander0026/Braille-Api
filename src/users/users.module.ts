import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [AuditLogModule, UploadModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
