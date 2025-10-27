import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { DatabaseModule } from '../../database/database.module';
import { AuditLogsService } from './audit-logs.service';

@Module({
  imports: [DatabaseModule],
  providers: [AuditLogsService, TrpcService],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}