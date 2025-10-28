import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { DatabaseModule } from '../../database/database.module';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsRouter } from './audit-logs.router';

@Module({
  imports: [DatabaseModule],
  providers: [AuditLogsService, AuditLogsRouter, TrpcService],
  exports: [AuditLogsService, AuditLogsRouter],
})
export class AuditLogsModule {}