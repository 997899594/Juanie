import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuditLogsService } from './audit-logs.service';

@Module({
  imports: [DatabaseModule],
  providers: [AuditLogsService],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}