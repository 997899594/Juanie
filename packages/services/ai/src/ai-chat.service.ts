import Anthropic from '@anthropic-ai/sdk'
import { Injectable, Logger } from '@nestjs/common'

/**
 * 用户意图类型
 */
export enum UserIntent {
  CREATE_PROJECT = 'create_project',
  DEPLOY_PROJECT = 'deploy_project',
  TROUBLESHOOT = 'troubleshoot',
  GENERATE_CONFIG = 'generate_config',
  QUESTION = 'question',
  UNKNOWN = 'unknown',
}

/**
 * 聊天消息
 */
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

/**
 * 意图检测结果
 */
export interface IntentDetectionResult {
  intent: UserIntent
  confidence: number
  entities: Record<string, any>
  rawMessage: string
}

/**
 * 聊天响应
 */
export interface ChatResponse {
  message: string
  intent: UserIntent
  action?: {
    type: string
    params: Record<string, any>
  }
  suggestions?: string[]
}

/**
 * AI 聊天服务
 * 提供自然语言交互能力
 */
@Injectable()
export class AIChatService {
  private readonly logger = new Logger(AIChatService.name)
  private readonly anthropic: Anthropic
  private readonly conversationHistory = new Map<string, ChatMessage[]>()

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  }

  /**
   * 处理用户消息
   */
  async chat(
    userId: string,
    message: string,
    context?: Record<string, any>,
  ): Promise<ChatResponse> {
    try {
      this.logger.log(`Processing chat message for user ${userId}`)

      // 获取对话历史
      const history = this.getConversationHistory(userId)

      // 添加用户消息到历史
      history.push({
        role: 'user',
        content: message,
        timestamp: new Date(),
      })

      // 检测用户意图
      const intentResult = await this.detectIntent(message, context)

      // 根据意图执行操作
      const actionResult = await this.executeAction(intentResult, context)

      // 生成响应
      const response = await this.generateResponse(message, intentResult, actionResult, history)

      // 添加助手响应到历史
      history.push({
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
      })

      // 保存对话历史（最多保留 20 条）
      if (history.length > 20) {
        history.splice(0, history.length - 20)
      }
      this.conversationHistory.set(userId, history)

      return response
    } catch (error) {
      this.logger.error('Failed to process chat message', error)
      throw error
    }
  }

  /**
   * 检测用户意图
   */
  async detectIntent(
    message: string,
    context?: Record<string, any>,
  ): Promise<IntentDetectionResult> {
    try {
      this.logger.log('Detecting user intent')

      // 使用 Claude 进行意图检测
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `You are an intent detection system for a DevOps platform. Analyze the user message and detect their intent.

Available intents:
- create_project: User wants to create a new project
- deploy_project: User wants to deploy a project
- troubleshoot: User needs help with an issue
- generate_config: User wants to generate configuration files
- question: User is asking a question
- unknown: Intent is unclear

User message: "${message}"

${context ? `Context: ${JSON.stringify(context, null, 2)}` : ''}

Respond with a JSON object:
{
  "intent": "intent_name",
  "confidence": 0.0-1.0,
  "entities": {
    "key": "value"
  }
}

Extract relevant entities like project names, template types, technologies, etc.`,
          },
        ],
      })

      if (!response.content || response.content.length === 0) {
        throw new Error('Empty response from AI')
      }

      const content = response.content[0]
      if (!content || content.type !== 'text') {
        throw new Error('Unexpected response type')
      }

      // 解析 JSON 响应
      const textContent = 'text' in content ? content.text : ''
      const jsonMatch = textContent.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('Failed to parse intent detection response')
      }

      const result = JSON.parse(jsonMatch[0])

      return {
        intent: result.intent as UserIntent,
        confidence: result.confidence,
        entities: result.entities || {},
        rawMessage: message,
      }
    } catch (error) {
      this.logger.error('Failed to detect intent', error)
      return {
        intent: UserIntent.UNKNOWN,
        confidence: 0,
        entities: {},
        rawMessage: message,
      }
    }
  }

  /**
   * 执行相应操作
   */
  private async executeAction(
    intentResult: IntentDetectionResult,
    context?: Record<string, any>,
  ): Promise<any> {
    try {
      this.logger.log(`Executing action for intent: ${intentResult.intent}`)

      switch (intentResult.intent) {
        case UserIntent.CREATE_PROJECT:
          return this.prepareProjectCreation(intentResult.entities)

        case UserIntent.DEPLOY_PROJECT:
          return this.prepareDeployment(intentResult.entities, context)

        case UserIntent.TROUBLESHOOT:
          return this.prepareTroubleshooting(intentResult.entities, context)

        case UserIntent.GENERATE_CONFIG:
          return this.prepareConfigGeneration(intentResult.entities)

        case UserIntent.QUESTION:
          return this.prepareQuestionAnswer(intentResult.rawMessage)

        default:
          return null
      }
    } catch (error) {
      this.logger.error('Failed to execute action', error)
      return null
    }
  }

  /**
   * 准备项目创建
   */
  private prepareProjectCreation(entities: Record<string, any>) {
    return {
      type: 'create_project',
      params: {
        name: entities.projectName || entities.name,
        template: entities.template || entities.templateType,
        description: entities.description,
      },
      needsConfirmation: true,
    }
  }

  /**
   * 准备部署
   */
  private prepareDeployment(entities: Record<string, any>, context?: Record<string, any>) {
    return {
      type: 'deploy_project',
      params: {
        projectId: entities.projectId || context?.projectId,
        environment: entities.environment || 'production',
      },
      needsConfirmation: true,
    }
  }

  /**
   * 准备故障诊断
   */
  private prepareTroubleshooting(entities: Record<string, any>, context?: Record<string, any>) {
    return {
      type: 'troubleshoot',
      params: {
        projectId: entities.projectId || context?.projectId,
        issue: entities.issue || entities.problem,
      },
      needsConfirmation: false,
    }
  }

  /**
   * 准备配置生成
   */
  private prepareConfigGeneration(entities: Record<string, any>) {
    return {
      type: 'generate_config',
      params: {
        configType: entities.configType || entities.type,
        technology: entities.technology || entities.tech,
        requirements: entities.requirements,
      },
      needsConfirmation: true,
    }
  }

  /**
   * 准备问题回答
   */
  private prepareQuestionAnswer(message: string) {
    return {
      type: 'answer_question',
      params: {
        question: message,
      },
      needsConfirmation: false,
    }
  }

  /**
   * 生成响应
   */
  private async generateResponse(
    userMessage: string,
    intentResult: IntentDetectionResult,
    actionResult: any,
    history: ChatMessage[],
  ): Promise<ChatResponse> {
    try {
      this.logger.log('Generating response')

      // 构建对话历史
      const conversationContext = history
        .slice(-5) // 只取最近 5 条
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join('\n')

      // 使用 Claude 生成响应
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: `You are a helpful DevOps assistant. Generate a friendly and informative response.

Conversation history:
${conversationContext}

Current user message: "${userMessage}"

Detected intent: ${intentResult.intent}
Confidence: ${intentResult.confidence}
Entities: ${JSON.stringify(intentResult.entities)}

${actionResult ? `Action to be performed: ${JSON.stringify(actionResult)}` : ''}

Generate a response that:
1. Acknowledges the user's request
2. Explains what will happen (if action is needed)
3. Asks for confirmation if needed
4. Provides helpful suggestions

Keep the tone friendly and professional. Use emojis sparingly.`,
          },
        ],
      })

      if (!response.content || response.content.length === 0) {
        throw new Error('Empty response from AI')
      }

      const content = response.content[0]
      if (!content || content.type !== 'text') {
        throw new Error('Unexpected response type')
      }

      // 生成建议
      const suggestions = this.generateSuggestions(intentResult.intent)

      const messageText = 'text' in content ? content.text : ''

      return {
        message: messageText,
        intent: intentResult.intent,
        action: actionResult?.needsConfirmation ? actionResult : undefined,
        suggestions,
      }
    } catch (error) {
      this.logger.error('Failed to generate response', error)
      return {
        message: "I'm sorry, I encountered an error. Could you please try again?",
        intent: intentResult.intent,
      }
    }
  }

  /**
   * 生成建议
   */
  private generateSuggestions(intent: UserIntent): string[] {
    const suggestions: Record<UserIntent, string[]> = {
      [UserIntent.CREATE_PROJECT]: [
        'Show me available templates',
        'What technologies do you support?',
        'Help me choose a template',
      ],
      [UserIntent.DEPLOY_PROJECT]: [
        'Check deployment status',
        'View deployment logs',
        'Rollback to previous version',
      ],
      [UserIntent.TROUBLESHOOT]: [
        'Show me the logs',
        'Check resource usage',
        'What are common issues?',
      ],
      [UserIntent.GENERATE_CONFIG]: [
        'Generate Dockerfile',
        'Generate Kubernetes config',
        'Generate CI/CD pipeline',
      ],
      [UserIntent.QUESTION]: [
        'How do I create a project?',
        'What is GitOps?',
        'How do I deploy to production?',
      ],
      [UserIntent.UNKNOWN]: ['Create a new project', 'Deploy my project', 'Help me troubleshoot'],
    }

    return suggestions[intent] || []
  }

  /**
   * 获取对话历史
   */
  private getConversationHistory(userId: string): ChatMessage[] {
    if (!this.conversationHistory.has(userId)) {
      this.conversationHistory.set(userId, [])
    }
    return this.conversationHistory.get(userId)!
  }

  /**
   * 清除对话历史
   */
  clearHistory(userId: string): void {
    this.conversationHistory.delete(userId)
    this.logger.log(`Cleared conversation history for user ${userId}`)
  }

  /**
   * 获取对话统计
   */
  getConversationStats(userId: string) {
    const history = this.getConversationHistory(userId)
    return {
      messageCount: history.length,
      userMessages: history.filter((msg) => msg.role === 'user').length,
      assistantMessages: history.filter((msg) => msg.role === 'assistant').length,
      firstMessage: history[0]?.timestamp,
      lastMessage: history[history.length - 1]?.timestamp,
    }
  }
}
