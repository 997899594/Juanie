import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { GeminiConfig } from '../config/gemini.config'
import type { ChatMessage } from '../dto/chat-request.dto'

@Injectable()
export class AiRouterService {
  constructor(private readonly configService: ConfigService) {}

  async selectModel(messages: ChatMessage[]) {
    const useAiRouter = this.configService.get('USE_AI_ROUTER') === 'true'

    if (useAiRouter) {
      return await this.selectModelWithAI(messages)
    }

    return this.selectModelWithRules(messages)
  }

  private selectModelWithRules(messages: ChatMessage[]) {
    const complexity = this.calculateComplexity(messages)

    if (complexity >= 0.5) {
      console.log('🚀 Using Gemini Pro (high complexity)')
      return GeminiConfig.getProModel()
    }

    console.log('⚡ Using Gemini Flash (low complexity)')
    return GeminiConfig.getFlashModel()
  }

  private async selectModelWithAI(messages: ChatMessage[]) {
    // TODO: Implement Flash-based classification in task 7.2
    // For now, fallback to rule-based
    console.log('⚠️ AI-based routing not yet implemented, using rules')
    return this.selectModelWithRules(messages)
  }

  private calculateComplexity(messages: ChatMessage[]): number {
    const lastMessage = messages[messages.length - 1]
    const content = lastMessage.content.toLowerCase()

    // Simple heuristics
    let score = 0

    // Long messages are more complex
    if (content.length > 500) score += 0.3

    // Multiple questions indicate complexity
    const questionCount = (content.match(/\?/g) || []).length
    if (questionCount > 2) score += 0.2

    // Technical keywords
    const technicalKeywords = [
      'kubernetes',
      'deployment',
      'yaml',
      'alert',
      'diagnostic',
      'root cause',
    ]
    const keywordMatches = technicalKeywords.filter((kw) => content.includes(kw)).length
    score += keywordMatches * 0.1

    return Math.min(score, 1.0)
  }
}
