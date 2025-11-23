import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AIChatService } from './ai-chat.service'
import { AIConfigGenerator } from './ai-config-generator.service'
import { AITroubleshooter } from './ai-troubleshooter.service'

@Module({
  imports: [ConfigModule],
  providers: [AIConfigGenerator, AITroubleshooter, AIChatService],
  exports: [AIConfigGenerator, AITroubleshooter, AIChatService],
})
export class AIModule {}
