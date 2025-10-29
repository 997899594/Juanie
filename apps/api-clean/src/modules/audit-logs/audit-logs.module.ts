import { Module } from '@nestjs/common'
import { AuditLogsRouter } from './audit-logs.router'
import { AuditLogsService } from './audit-logs.service'

@Module({
  providers: [AuditLogsService, AuditLogsRouter],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}
