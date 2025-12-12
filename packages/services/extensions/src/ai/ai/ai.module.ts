import { DatabaseModule } from '@juanie/core/database'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AICacheService } from '../cache/ai-cache.service'
import { CodeReviewService } from '../code-review.service'
import { ConfigGeneratorService } from '../config-gen/config-generator.service'
import { ConversationService } from '../conversations/conversation.service'
import { FunctionCallingService } from '../functions/function-calling.service'
import { MultimodalService } from '../multimodal/multimodal.service'
import { OllamaClient } from '../ollama.client'
import { PromptService } from '../prompts/prompt.service'
import { RAGService } from '../rag/rag.service'
import { ContentFilterService } from '../security/content-filter.service'
import { TroubleshootingService } from '../troubleshooting/troubleshooting.service'
import { UsageTrackingService } from '../usage/usage-tracking.service'
import { AIService } from './ai.service'
import { AIChatService } from './ai-chat.service'
import { AIClientFactory } from './ai-client-factory'
import { AIConfigGenerator } from './ai-config-generator.service'
import { AITroubleshooter } from './ai-troubleshooter.service'

@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [
    OllamaClient,
    CodeReviewService,
    ConfigGeneratorService,
    AIConfigGenerator,
    AITroubleshooter,
    TroubleshootingService,
    AIChatService,
    AIService,
    AIClientFactory,
    PromptService,
    RAGService,
    ConversationService,
    UsageTrackingService,
    AICacheService,
    ContentFilterService,
    FunctionCallingService,
    MultimodalService,
  ],
  exports: [
    OllamaClient,
    CodeReviewService,
    ConfigGeneratorService,
    AIConfigGenerator,
    AITroubleshooter,
    TroubleshootingService,
    AIChatService,
    AIService,
    AIClientFactory,
    PromptService,
    RAGService,
    ConversationService,
    UsageTrackingService,
    AICacheService,
    ContentFilterService,
    FunctionCallingService,
    MultimodalService,
  ],
})
export class AIModule {}
