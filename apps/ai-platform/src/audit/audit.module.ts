import { Module } from '@nestjs/common'
import { AuditLogService } from './services/audit-log.service'
import { MetricsService } from './services/metrics.service'

@Module({
  providers: [AuditLogService, MetricsService],
  exports: [AuditLogService, MetricsService],
})
export class AuditModule {}
