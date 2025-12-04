import type {
  AIModel,
  OllamaGenerateRequest,
  OllamaGenerateResponse,
  OllamaModelInfo,
} from '@juanie/types'
import { ErrorCode, ErrorFactory } from '@juanie/types'
import { Injectable } from '@nestjs/common'
import { Logger } from '@juanie/core/logger'
import { ConfigService } from '@nestjs/config'

/**
 * Ollama 客户端服务
 * 封装与 Ollama 本地 AI 模型的交互
 */
@Injectable()
export class OllamaClient {
  private readonly logger = new Logger(OllamaClient.name)
  private readonly baseUrl: string
  private readonly defaultModel: AIModel
  private readonly timeout: number

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get('OLLAMA_BASE_URL', 'http://localhost:11434')
    this.defaultModel = this.configService.get('OLLAMA_DEFAULT_MODEL', 'qwen2.5-coder:7b')
    this.timeout = this.configService.get('OLLAMA_TIMEOUT', 120000) // 2 分钟
  }

  /**
   * 生成文本（非流式）
   */
  async generate(request: OllamaGenerateRequest): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: request.model || this.defaultModel,
          prompt: request.prompt,
          system: request.system,
          temperature: request.temperature ?? 0.7,
          stream: false,
          options: {
            num_predict: request.maxTokens ?? 4096,
          },
        }),
        signal: AbortSignal.timeout(this.timeout),
      })

      if (!response.ok) {
        const error = await response.text()
        throw ErrorFactory.ai.inferenceFailed(`Ollama API error: ${error}`)
      }

      const data = (await response.json()) as OllamaGenerateResponse
      return data.response
    } catch (error) {
      this.logger.error('Ollama generate failed:', error)

      if (error instanceof Error && error.name === 'AppError') {
        throw error
      }

      if (error instanceof Error && error.name === 'TimeoutError') {
        throw ErrorFactory.ai.timeout()
      }

      throw ErrorFactory.ai.inferenceFailed(
        error instanceof Error ? error.message : 'Unknown error',
      )
    }
  }

  /**
   * 流式生成文本
   */
  async *generateStream(request: OllamaGenerateRequest): AsyncGenerator<string, void, unknown> {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: request.model || this.defaultModel,
          prompt: request.prompt,
          system: request.system,
          temperature: request.temperature ?? 0.7,
          stream: true,
          options: {
            num_predict: request.maxTokens ?? 4096,
          },
        }),
        signal: AbortSignal.timeout(this.timeout),
      })

      if (!response.ok) {
        const error = await response.text()
        throw ErrorFactory.ai.inferenceFailed(`Ollama API error: ${error}`)
      }

      if (!response.body) {
        throw ErrorFactory.ai.inferenceFailed('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter((line) => line.trim())

        for (const line of lines) {
          try {
            const data = JSON.parse(line) as OllamaGenerateResponse
            if (data.response) {
              yield data.response
            }
          } catch {
            this.logger.warn('Failed to parse stream chunk:', line)
          }
        }
      }
    } catch (error) {
      this.logger.error('Ollama stream generation failed:', error)

      if (error instanceof Error && error.name === 'AppError') {
        throw error
      }

      if (error instanceof Error && error.name === 'TimeoutError') {
        throw ErrorFactory.ai.timeout()
      }

      throw ErrorFactory.ai.inferenceFailed(
        error instanceof Error ? error.message : 'Unknown error',
      )
    }
  }

  /**
   * 获取可用模型列表
   */
  async listModels(): Promise<OllamaModelInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        throw ErrorFactory.ai.inferenceFailed('Failed to list models')
      }

      const data = (await response.json()) as { models: OllamaModelInfo[] }
      return data.models || []
    } catch (error) {
      this.logger.error('Failed to list Ollama models:', error)

      if (error instanceof Error && error.name === 'AppError') {
        throw error
      }

      throw ErrorFactory.ai.inferenceFailed(
        error instanceof Error ? error.message : 'Unknown error',
      )
    }
  }

  /**
   * 检查服务健康状态
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      })
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * 拉取模型（如果不存在）
   */
  async pullModel(model: AIModel): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: model }),
        signal: AbortSignal.timeout(600000), // 10 分钟，拉取可能很慢
      })

      if (!response.ok) {
        throw ErrorFactory.ai.inferenceFailed(`Failed to pull model ${model}`)
      }

      this.logger.log(`Model ${model} pulled successfully`)
    } catch (error) {
      this.logger.error(`Failed to pull model ${model}:`, error)
      throw error
    }
  }
}
