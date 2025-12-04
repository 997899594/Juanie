import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { CodeReviewService } from '../code-review.service'
import { OllamaClient } from '../ollama.client'
import { AIChatService } from './ai-chat.service'
import { AIConfigGenerator } from './ai-config-generator.service'
import { AITroubleshooter } from './ai-troubleshooter.service'

@Module({
  imports: [ConfigModule],
  providers: [OllamaClient, CodeReviewService, AIConfigGenerator, AITroubleshooter, AIChatService],
  exports: [OllamaClient, CodeReviewService, AIConfigGenerator, AITroubleshooter, AIChatService],
})
export class AIModule {}
