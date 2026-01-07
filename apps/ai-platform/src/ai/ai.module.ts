import { Module } from '@nestjs/common'
import { AiChatController } from './controllers/ai-chat.controller'
import { AiChatService } from './services/ai-chat.service'
import { AiRouterService } from './services/ai-router.service'
import { ContextCachingService } from './services/context-caching.service'
import { SafetyGuardService } from './services/safety-guard.service'
import { ToolRegistryService } from './services/tool-registry.service'

@Module({
  controllers: [AiChatController],
  providers: [
    AiChatService,
    ToolRegistryService,
    AiRouterService,
    SafetyGuardService,
    ContextCachingService,
  ],
  exports: [AiChatService],
})
export class AiModule {}
