import { Logger } from '@juanie/core/logger'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Ollama } from 'ollama'

/**
 * K8s 配置生成选项
 */
export interface GenerateK8sConfigOptions {
  appName: string
  appType: 'web' | 'api' | 'worker' | 'cron'
  language: string
  framework?: string
  port?: number
  replicas?: number
  resources?: {
    cpu: string
    memory: string
  }
  envVars?: Record<string, string>
}

/**
 * Dockerfile 生成选项
 */
export interface GenerateDockerfileOptions {
  language: string
  framework?: string
  buildCommand?: string
  startCommand?: string
  port?: number
  workdir?: string
}

/**
 * 优化建议
 */
export interface OptimizationSuggestion {
  type: 'performance' | 'security' | 'cost' | 'reliability'
  severity: 'low' | 'medium' | 'high'
  title: string
  description: string
  suggestion: string
  code?: string
}

/**
 * AI 配置生成器服务
 * 使用 Ollama 本地 AI 模型生成配置
 */
@Injectable()
export class AIConfigGenerator {
  private readonly logger = new Logger(AIConfigGenerator.name)
  private ollama: Ollama
  private readonly model = 'codellama' // 使用 CodeLlama 模型

  // System prompts
  private readonly K8S_SYSTEM_PROMPT =
    `You are a Kubernetes expert. Generate valid Kubernetes YAML configurations.
Rules:
- Output ONLY valid YAML, no explanations
- Use best practices for production
- Include resource limits
- Add health checks
- Use proper labels and selectors`

  private readonly DOCKERFILE_SYSTEM_PROMPT =
    `You are a Docker expert. Generate optimized Dockerfiles.
Rules:
- Output ONLY valid Dockerfile, no explanations
- Use multi-stage builds when appropriate
- Minimize image size
- Follow security best practices
- Use specific base image versions`

  private readonly OPTIMIZATION_SYSTEM_PROMPT =
    `You are a DevOps expert. Analyze configurations and provide optimization suggestions.
Rules:
- Focus on practical improvements
- Prioritize by impact
- Provide specific code examples
- Consider security, performance, and cost`

  constructor(private readonly config: ConfigService) {
    const ollamaHost = this.config.get<string>('OLLAMA_HOST') || 'http://localhost:11434'
    this.ollama = new Ollama({ host: ollamaHost })
    this.logger.log(`AI Config Generator initialized with Ollama at ${ollamaHost}`)
  }

  /**
   * 生成 Kubernetes Deployment 配置
   */
  async generateK8sConfig(options: GenerateK8sConfigOptions): Promise<string> {
    this.logger.log(`Generating K8s config for ${options.appName}`)

    const prompt = this.buildK8sPrompt(options)

    try {
      const response = await this.ollama.generate({
        model: this.model,
        prompt,
        system: this.K8S_SYSTEM_PROMPT,
        options: {
          temperature: 0.3, // 低温度，更确定性的输出
          top_p: 0.9,
        },
      })

      const config = this.extractYaml(response.response)
      this.logger.log(`Generated K8s config (${config.length} chars)`)

      return config
    } catch (error) {
      this.logger.error('Failed to generate K8s config:', error)
      throw new Error(`AI generation failed: ${error}`)
    }
  }

  /**
   * 生成 Dockerfile
   */
  async generateDockerfile(options: GenerateDockerfileOptions): Promise<string> {
    this.logger.log(`Generating Dockerfile for ${options.language}`)

    const prompt = this.buildDockerfilePrompt(options)

    try {
      const response = await this.ollama.generate({
        model: this.model,
        prompt,
        system: this.DOCKERFILE_SYSTEM_PROMPT,
        options: {
          temperature: 0.3,
          top_p: 0.9,
        },
      })

      const dockerfile = this.extractCode(response.response)
      this.logger.log(`Generated Dockerfile (${dockerfile.length} chars)`)

      return dockerfile
    } catch (error) {
      this.logger.error('Failed to generate Dockerfile:', error)
      throw new Error(`AI generation failed: ${error}`)
    }
  }

  /**
   * 分析配置并提供优化建议
   */
  async suggestOptimizations(
    config: string,
    type: 'k8s' | 'dockerfile',
  ): Promise<OptimizationSuggestion[]> {
    this.logger.log(`Analyzing ${type} configuration`)

    const prompt = `Analyze this ${type} configuration and provide optimization suggestions:

\`\`\`
${config}
\`\`\`

Provide suggestions in JSON format:
[
  {
    "type": "performance|security|cost|reliability",
    "severity": "low|medium|high",
    "title": "Short title",
    "description": "What's the issue",
    "suggestion": "How to fix it",
    "code": "Example code (optional)"
  }
]`

    try {
      const response = await this.ollama.generate({
        model: this.model,
        prompt,
        system: this.OPTIMIZATION_SYSTEM_PROMPT,
        options: {
          temperature: 0.5,
          top_p: 0.9,
        },
      })

      const suggestions = this.parseOptimizationSuggestions(response.response)
      this.logger.log(`Generated ${suggestions.length} optimization suggestions`)

      return suggestions
    } catch (error) {
      this.logger.error('Failed to generate optimization suggestions:', error)
      return []
    }
  }

  /**
   * 构建 K8s 配置生成的 prompt
   */
  private buildK8sPrompt(options: GenerateK8sConfigOptions): string {
    return `Generate a Kubernetes Deployment YAML for:
- App name: ${options.appName}
- App type: ${options.appType}
- Language: ${options.language}
${options.framework ? `- Framework: ${options.framework}` : ''}
- Port: ${options.port || 3000}
- Replicas: ${options.replicas || 2}
- CPU: ${options.resources?.cpu || '100m'}
- Memory: ${options.resources?.memory || '128Mi'}
${options.envVars ? `- Environment variables: ${JSON.stringify(options.envVars)}` : ''}

Include:
- Deployment with proper labels
- Resource requests and limits
- Liveness and readiness probes
- Environment variables
- Security context (non-root user)

Output ONLY the YAML, no explanations.`
  }

  /**
   * 构建 Dockerfile 生成的 prompt
   */
  private buildDockerfilePrompt(options: GenerateDockerfileOptions): string {
    return `Generate an optimized Dockerfile for:
- Language: ${options.language}
${options.framework ? `- Framework: ${options.framework}` : ''}
${options.buildCommand ? `- Build command: ${options.buildCommand}` : ''}
${options.startCommand ? `- Start command: ${options.startCommand}` : ''}
- Port: ${options.port || 3000}
- Workdir: ${options.workdir || '/app'}

Requirements:
- Use multi-stage build if applicable
- Minimize image size
- Use specific base image versions
- Run as non-root user
- Include health check

Output ONLY the Dockerfile, no explanations.`
  }

  /**
   * 从 AI 响应中提取 YAML
   */
  private extractYaml(response: string): string {
    // 尝试提取 ```yaml 代码块
    const yamlMatch = response.match(/```(?:yaml|yml)?\n([\s\S]*?)\n```/)
    if (yamlMatch?.[1]) {
      return yamlMatch[1].trim()
    }

    // 如果没有代码块，返回整个响应（去除前后空白）
    return response.trim()
  }

  /**
   * 从 AI 响应中提取代码
   */
  private extractCode(response: string): string {
    // 尝试提取代码块
    const codeMatch = response.match(/```(?:\w+)?\n([\s\S]*?)\n```/)
    if (codeMatch?.[1]) {
      return codeMatch[1].trim()
    }

    return response.trim()
  }

  /**
   * 解析优化建议
   */
  private parseOptimizationSuggestions(response: string): OptimizationSuggestion[] {
    try {
      // 尝试提取 JSON
      const jsonMatch = response.match(/```(?:json)?\n([\s\S]*?)\n```/)
      const jsonStr = jsonMatch?.[1] || response

      const suggestions = JSON.parse(jsonStr)

      if (Array.isArray(suggestions)) {
        return suggestions.filter(this.isValidSuggestion)
      }

      return []
    } catch (error) {
      this.logger.warn('Failed to parse optimization suggestions:', error)
      return []
    }
  }

  /**
   * 验证建议格式
   */
  private isValidSuggestion(suggestion: unknown): suggestion is OptimizationSuggestion {
    if (!suggestion || typeof suggestion !== 'object') return false

    const s = suggestion as Record<string, unknown>
    return (
      ['performance', 'security', 'cost', 'reliability'].includes(s.type as string) &&
      ['low', 'medium', 'high'].includes(s.severity as string) &&
      typeof s.title === 'string' &&
      typeof s.description === 'string' &&
      typeof s.suggestion === 'string'
    )
  }

  /**
   * 检查 Ollama 服务是否可用
   */
  async checkHealth(): Promise<boolean> {
    try {
      await this.ollama.list()
      return true
    } catch (error) {
      this.logger.error('Ollama health check failed:', error)
      return false
    }
  }

  /**
   * 获取可用的模型列表
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await this.ollama.list()
      return response.models.map((m) => m.name)
    } catch (error) {
      this.logger.error('Failed to list models:', error)
      return []
    }
  }
}
