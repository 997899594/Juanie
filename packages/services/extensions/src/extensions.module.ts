import { Module } from '@nestjs/common'
import { AIModule } from './ai/ai/ai.module'
import { OllamaModule } from './ai/ollama/ollama.module'
import { AiAssistantsModule } from './ai/assistants/ai-assistants.module'
import { AuditLogsModule } from './monitoring/audit-logs/audit-logs.module'
import { CostTrackingModule } from './monitoring/cost-tracking/cost-tracking.module'
import { NotificationsModule } from './notifications/notifications.module'
import { SecurityPoliciesModule } from './security/security-policies.module'

/**
 * Extensions Module - 扩展层模块
 * 提供 AI、监控、通知和安全功能
 */
@Module({
  imports: [
    // AI 相关
    AIModule,
    OllamaModule,
    AiAssistantsModule,
    // 监控相关
    AuditLogsModule,
    CostTrackingModule,
    // 通知
    NotificationsModule,
    // 安全
    SecurityPoliciesModule,
  ],
  exports: [
    AIModule,
    OllamaModule,
    AiAssistantsModule,
    AuditLogsModule,
    CostTrackingModule,
    NotificationsModule,
    SecurityPoliciesModule,
  ],
})
export class ExtensionsModule {}
