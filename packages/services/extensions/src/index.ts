// Extensions Layer - 扩展层服务
// 提供 AI、监控和安全功能
//
// 注意：AuditLogs 和 Notifications 已移到 Foundation 层

// 类型导出（从 @juanie/types 统一管理）
export type * from '@juanie/types'

// AI 服务
export { AIModule } from './ai/ai/ai.module'
export { AIService } from './ai/ai/ai.service'
export { AIChatService } from './ai/ai/ai-chat.service'
export { AIConfigGenerator } from './ai/ai/ai-config-generator.service'
export { AITroubleshooter } from './ai/ai/ai-troubleshooter.service'
export { AiAssistantsModule } from './ai/assistants/ai-assistants.module'
export { AiAssistantsService } from './ai/assistants/ai-assistants.service'
export { AICacheService } from './ai/cache/ai-cache.service'
export { CodeReviewService } from './ai/code-review.service'
export { ConfigGeneratorService } from './ai/config-gen/config-generator.service'
export { ConversationService } from './ai/conversations/conversation.service'
export { FunctionCallingService } from './ai/functions/function-calling.service'
export { MultimodalService } from './ai/multimodal/multimodal.service'
export { OllamaModule } from './ai/ollama/ollama.module'
export { OllamaService } from './ai/ollama/ollama.service'
export { PromptService } from './ai/prompts/prompt.service'
export { RAGService } from './ai/rag/rag.service'
export { ContentFilterService } from './ai/security/content-filter.service'
export { TroubleshootingService } from './ai/troubleshooting/troubleshooting.service'
export { UsageTrackingService } from './ai/usage/usage-tracking.service'
// 模块导出
export { ExtensionsModule } from './extensions.module'
// 监控服务
export { CostTrackingModule } from './monitoring/cost-tracking/cost-tracking.module'
export { CostTrackingService } from './monitoring/cost-tracking/cost-tracking.service'
// 安全服务
export { SecurityPoliciesModule } from './security/security-policies.module'
export { SecurityPoliciesService } from './security/security-policies.service'
