import { DatabaseModule } from '@juanie/core/database'
import { Module } from '@nestjs/common'
import { AuditLogsService } from './audit-logs.service'

@Module({
  imports: [DatabaseModule],
  providers: [AuditLogsService],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}
