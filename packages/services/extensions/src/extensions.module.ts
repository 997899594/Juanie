import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AIModule } from './ai/ai/ai.module'
import { AiAssistantsModule } from './ai/assistants/ai-assistants.module'
import { OllamaModule } from './ai/ollama/ollama.module'
import { CostTrackingModule } from './monitoring/cost-tracking/cost-tracking.module'
import { SecurityPoliciesModule } from './security/security-policies.module'

/**
 * Extensions Module - 扩展层模块
 * 提供 AI、监控和安全功能
 *
 * 注意：AuditLogs 和 Notifications 已移到 Foundation 层
 */
@Module({
  imports: [
    // AI 相关
    AIModule,
    OllamaModule,
    AiAssistantsModule,
    // 监控相关
    CostTrackingModule,
    // 安全
    SecurityPoliciesModule,
  ],
  exports: [AIModule, OllamaModule, AiAssistantsModule, CostTrackingModule, SecurityPoliciesModule],
})
export class ExtensionsModule {}
