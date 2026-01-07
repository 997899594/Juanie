import { Injectable } from '@nestjs/common'

@Injectable()
export class AuditLogService {
  /**
   * Log an audit event
   * TODO: Implement full audit logging with Drizzle ORM (Task 13.1)
   */
  async log(event: {
    tenantId: string
    userId?: string
    action: string
    resource: string
    metadata?: Record<string, unknown>
  }): Promise<void> {
    console.log('📝 Audit log:', event)
    // Placeholder - will be implemented in Task 13.1
  }
}
