// Extensions Layer - 扩展层服务
// 提供 AI、监控和安全功能
//
// 注意：AuditLogs 和 Notifications 已移到 Foundation 层

export { AIModule } from './ai/ai/ai.module'
// 服务导出
export { AIChatService } from './ai/ai/ai-chat.service'
export { AIConfigGenerator } from './ai/ai/ai-config-generator.service'
export { AITroubleshooter } from './ai/ai/ai-troubleshooter.service'
// 类型导出
export * from './ai/ai.types'
export { AiAssistantsModule } from './ai/assistants/ai-assistants.module'
export { AiAssistantsService } from './ai/assistants/ai-assistants.service'
export { OllamaModule } from './ai/ollama/ollama.module'
export { OllamaService } from './ai/ollama/ollama.service'
// 模块导出
export { ExtensionsModule } from './extensions.module'
export { CostTrackingModule } from './monitoring/cost-tracking/cost-tracking.module'
export { CostTrackingService } from './monitoring/cost-tracking/cost-tracking.service'
export * from './monitoring/monitoring.types'
export * from './security/security.types'
export { SecurityPoliciesModule } from './security/security-policies.module'
export { SecurityPoliciesService } from './security/security-policies.service'
