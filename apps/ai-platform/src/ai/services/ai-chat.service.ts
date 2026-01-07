import { Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { streamText } from 'ai'
import { GeminiConfig } from '../config/gemini.config'
import type { ChatRequestDto } from '../dto/chat-request.dto'
import { AiRouterService } from './ai-router.service'
import { ContextCachingService } from './context-caching.service'
import { SafetyGuardService } from './safety-guard.service'
import { ToolRegistryService } from './tool-registry.service'

@Injectable()
export class AiChatService implements OnModuleInit {
  constructor(
    private readonly configService: ConfigService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly aiRouter: AiRouterService,
    private readonly safetyGuard: SafetyGuardService,
    private readonly contextCaching: ContextCachingService,
  ) {}

  onModuleInit() {
    // Initialize Gemini config with ConfigService
    GeminiConfig.initialize(this.configService)
  }

  async chat(request: ChatRequestDto): Promise<ReturnType<typeof streamText>> {
    const { messages, tenantId = 'default' } = request

    // Safety check on input
    const lastMessage = messages[messages.length - 1]
    const safetyCheck = await this.safetyGuard.checkInput(lastMessage.content)
    if (!safetyCheck.safe) {
      throw new Error(`Input blocked: ${safetyCheck.reason}`)
    }

    // Get cached context for tenant
    const cachedContext = await this.contextCaching.getCachedContext(tenantId)

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(cachedContext)

    // Select model based on complexity
    const model = await this.aiRouter.selectModel(messages)

    // Get available tools
    const tools = this.toolRegistry.getTools()

    // Stream response with tools
    const result = streamText({
      model,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      tools,
      onFinish: async ({ text, usage }) => {
        console.log('✅ Generation finished')
        console.log('Usage:', usage)

        // Safety check on output
        const outputCheck = await this.safetyGuard.checkOutput(text)
        if (!outputCheck.safe) {
          console.warn('⚠️ Output safety check failed:', outputCheck.reason)
        }
      },
    })

    return result
  }

  private buildSystemPrompt(cachedContext?: string | null): string {
    const basePrompt = `You are an AI-powered DevOps and SRE assistant.

You have access to tools for:
- Kubernetes cluster management and diagnostics
- Deployment planning and validation
- Alert analysis and root cause investigation

${this.toolRegistry.getToolDescriptions()}

Always use tools when appropriate. Provide clear, actionable responses.`

    if (cachedContext) {
      return `${basePrompt}\n\n## Cached Context\n${cachedContext}`
    }

    return basePrompt
  }
}
