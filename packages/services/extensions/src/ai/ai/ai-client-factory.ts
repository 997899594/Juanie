import type { AIClientConfig } from '@juanie/types'
import { ErrorFactory } from '@juanie/types'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import { ClaudeAdapter } from './adapters/claude.adapter'
import { OllamaAdapter } from './adapters/ollama.adapter'
import { OpenAIAdapter } from './adapters/openai.adapter'
import { QwenAdapter } from './adapters/qwen.adapter'
import { ZhipuAdapter } from './adapters/zhipu.adapter'
import type { IAIClient } from './ai-client.interface'

/**
 * AI 客户端工厂
 * 根据配置创建不同提供商的 AI 客户端适配器
 */
@Injectable()
export class AIClientFactory {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AIClientFactory.name)
  }

  /**
   * 创建 AI 客户端
   * @param config - AI 客户端配置
   * @returns AI 客户端实例
   * @throws {AppError} 当提供商不支持时
   */
  createClient(config: AIClientConfig): IAIClient {
    // 从环境变量获取 API 密钥（如果配置中未提供）
    const apiKey = config.apiKey || this.getApiKey(config.provider)

    switch (config.provider) {
      case 'anthropic':
        return new ClaudeAdapter({ ...config, apiKey })
      case 'openai':
        return new OpenAIAdapter({ ...config, apiKey })
      case 'zhipu':
        return new ZhipuAdapter({ ...config, apiKey })
      case 'qwen':
        return new QwenAdapter({ ...config, apiKey })
      case 'ollama':
        return new OllamaAdapter(config, this.configService, this.logger)
      default:
        throw ErrorFactory.ai.inferenceFailed(`Unsupported provider: ${config.provider}`)
    }
  }

  /**
   * 从环境变量获取 API 密钥
   * @param provider - AI 提供商
   * @returns API 密钥（如果存在）
   */
  private getApiKey(provider: string): string | undefined {
    const keyMap: Record<string, string> = {
      anthropic: 'ANTHROPIC_API_KEY',
      openai: 'OPENAI_API_KEY',
      zhipu: 'ZHIPU_API_KEY',
      qwen: 'QWEN_API_KEY',
    }

    const envKey = keyMap[provider]
    return envKey ? this.configService.get<string>(envKey) : undefined
  }
}
