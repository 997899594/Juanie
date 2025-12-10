import { Logger } from '@juanie/core/logger'
import type { AIClientConfig, AIMessage } from '@juanie/types'
import { Injectable } from '@nestjs/common'
import { AIService } from '../ai/ai.service'

/**
 * Kubernetes Deployment 配置生成选项
 */
export interface K8sDeploymentOptions {
  appName: string
  appType: 'web' | 'api' | 'worker' | 'cron'
  language: string
  framework?: string
  port?: number
  replicas?: number
  resources?: {
    requests?: {
      cpu?: string
      memory?: string
    }
    limits?: {
      cpu?: string
      memory?: string
    }
  }
  envVars?: Record<string, string>
  healthCheck?: {
    path: string
    port?: number
  }
}

/**
 * Dockerfile 生成选项
 */
export interface DockerfileOptions {
  language: string
  framework?: string
  nodeVersion?: string
  pythonVersion?: string
  buildCommand?: string
  startCommand?: string
  port?: number
  workdir?: string
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'pip' | 'poetry'
}

/**
 * GitHub Actions 配置生成选项
 */
export interface GitHubActionsOptions {
  appName: string
  language: string
  framework?: string
  buildCommand?: string
  testCommand?: string
  lintCommand?: string
  branches?: string[]
  registry?: string
  deployEnvironments?: Array<{
    name: string
    url?: string
    branch: string
  }>
}

/**
 * GitLab CI 配置生成选项
 */
export interface GitLabCIOptions {
  appName: string
  language: string
  framework?: string
  buildCommand?: string
  testCommand?: string
  lintCommand?: string
  branches?: string[]
  registry?: string
  deployEnvironments?: Array<{
    name: string
    url?: string
    branch: string
  }>
}

/**
 * 配置优化建议
 */
export interface OptimizationSuggestion {
  category: 'performance' | 'security' | 'cost' | 'reliability'
  severity: 'low' | 'medium' | 'high'
  title: string
  description: string
  recommendation: string
  example?: string
}

/**
 * 配置生成结果
 */
export interface ConfigGenerationResult {
  config: string
  optimizations: OptimizationSuggestion[]
}

/**
 * 配置生成服务
 * 使用 AI 生成各种配置文件
 */
@Injectable()
export class ConfigGeneratorService {
  private readonly logger = new Logger(ConfigGeneratorService.name)

  constructor(private readonly aiService: AIService) {}

  /**
   * 生成 Kubernetes Deployment 配置
   */
  async generateK8sDeployment(
    options: K8sDeploymentOptions,
    aiConfig?: AIClientConfig,
  ): Promise<ConfigGenerationResult> {
    this.logger.log(`Generating K8s Deployment for ${options.appName}`)

    const prompt = this.buildK8sDeploymentPrompt(options)
    const config = await this.generateConfig(prompt, 'kubernetes', aiConfig)
    const optimizations = await this.analyzeConfig(config, 'kubernetes', aiConfig)

    return { config, optimizations }
  }

  /**
   * 生成 Dockerfile
   */
  async generateDockerfile(
    options: DockerfileOptions,
    aiConfig?: AIClientConfig,
  ): Promise<ConfigGenerationResult> {
    this.logger.log(`Generating Dockerfile for ${options.language}`)

    const prompt = this.buildDockerfilePrompt(options)
    const config = await this.generateConfig(prompt, 'dockerfile', aiConfig)
    const optimizations = await this.analyzeConfig(config, 'dockerfile', aiConfig)

    return { config, optimizations }
  }

  /**
   * 生成 GitHub Actions 配置
   */
  async generateGitHubActions(
    options: GitHubActionsOptions,
    aiConfig?: AIClientConfig,
  ): Promise<ConfigGenerationResult> {
    this.logger.log(`Generating GitHub Actions for ${options.appName}`)

    const prompt = this.buildGitHubActionsPrompt(options)
    const config = await this.generateConfig(prompt, 'github-actions', aiConfig)
    const optimizations = await this.analyzeConfig(config, 'github-actions', aiConfig)

    return { config, optimizations }
  }

  /**
   * 生成 GitLab CI 配置
   */
  async generateGitLabCI(
    options: GitLabCIOptions,
    aiConfig?: AIClientConfig,
  ): Promise<ConfigGenerationResult> {
    this.logger.log(`Generating GitLab CI for ${options.appName}`)

    const prompt = this.buildGitLabCIPrompt(options)
    const config = await this.generateConfig(prompt, 'gitlab-ci', aiConfig)
    const optimizations = await this.analyzeConfig(config, 'gitlab-ci', aiConfig)

    return { config, optimizations }
  }

  /**
   * 构建 K8s Deployment prompt
   */
  private buildK8sDeploymentPrompt(options: K8sDeploymentOptions): string {
    const parts = [
      'Generate a production-ready Kubernetes Deployment YAML configuration with the following specifications:',
      '',
      `Application Details:`,
      `- Name: ${options.appName}`,
      `- Type: ${options.appType}`,
      `- Language: ${options.language}`,
    ]

    if (options.framework) {
      parts.push(`- Framework: ${options.framework}`)
    }

    parts.push(
      '',
      `Configuration:`,
      `- Port: ${options.port || 3000}`,
      `- Replicas: ${options.replicas || 2}`,
    )

    if (options.resources) {
      parts.push(`- Resources:`)
      if (options.resources.requests) {
        parts.push(
          `  - Requests: CPU ${options.resources.requests.cpu || '100m'}, Memory ${options.resources.requests.memory || '128Mi'}`,
        )
      }
      if (options.resources.limits) {
        parts.push(
          `  - Limits: CPU ${options.resources.limits.cpu || '500m'}, Memory ${options.resources.limits.memory || '512Mi'}`,
        )
      }
    }

    if (options.healthCheck) {
      parts.push(`- Health Check: ${options.healthCheck.path}`)
    }

    if (options.envVars && Object.keys(options.envVars).length > 0) {
      parts.push(`- Environment Variables: ${Object.keys(options.envVars).join(', ')}`)
    }

    parts.push(
      '',
      'Requirements:',
      '- Include proper labels and selectors',
      '- Add liveness and readiness probes',
      '- Configure resource requests and limits',
      '- Use security context (non-root user)',
      '- Include rolling update strategy',
      '- Add pod disruption budget considerations',
      '',
      'Output ONLY valid YAML, no explanations or markdown code blocks.',
    )

    return parts.join('\n')
  }

  /**
   * 构建 Dockerfile prompt
   */
  private buildDockerfilePrompt(options: DockerfileOptions): string {
    const parts = [
      'Generate an optimized, production-ready Dockerfile with the following specifications:',
      '',
      `Language: ${options.language}`,
    ]

    if (options.framework) {
      parts.push(`Framework: ${options.framework}`)
    }

    if (options.nodeVersion) {
      parts.push(`Node.js Version: ${options.nodeVersion}`)
    }

    if (options.pythonVersion) {
      parts.push(`Python Version: ${options.pythonVersion}`)
    }

    if (options.packageManager) {
      parts.push(`Package Manager: ${options.packageManager}`)
    }

    if (options.buildCommand) {
      parts.push(`Build Command: ${options.buildCommand}`)
    }

    if (options.startCommand) {
      parts.push(`Start Command: ${options.startCommand}`)
    }

    parts.push(
      `Port: ${options.port || 3000}`,
      `Working Directory: ${options.workdir || '/app'}`,
      '',
      'Requirements:',
      '- Use multi-stage build to minimize image size',
      '- Use specific base image versions (no :latest)',
      '- Run as non-root user',
      '- Include health check',
      '- Optimize layer caching',
      '- Follow security best practices',
      '- Add .dockerignore recommendations in comments',
      '',
      'Output ONLY valid Dockerfile content, no explanations or markdown code blocks.',
    )

    return parts.join('\n')
  }

  /**
   * 构建 GitHub Actions prompt
   */
  private buildGitHubActionsPrompt(options: GitHubActionsOptions): string {
    const parts = [
      'Generate a complete GitHub Actions workflow YAML for CI/CD with the following specifications:',
      '',
      `Application: ${options.appName}`,
      `Language: ${options.language}`,
    ]

    if (options.framework) {
      parts.push(`Framework: ${options.framework}`)
    }

    parts.push(
      `Branches: ${options.branches?.join(', ') || 'main, develop'}`,
      `Registry: ${options.registry || 'ghcr.io'}`,
    )

    if (options.buildCommand) {
      parts.push(`Build Command: ${options.buildCommand}`)
    }

    if (options.testCommand) {
      parts.push(`Test Command: ${options.testCommand}`)
    }

    if (options.lintCommand) {
      parts.push(`Lint Command: ${options.lintCommand}`)
    }

    if (options.deployEnvironments && options.deployEnvironments.length > 0) {
      parts.push(
        '',
        'Deploy Environments:',
        ...options.deployEnvironments.map(
          (env) => `- ${env.name} (${env.branch})${env.url ? ` -> ${env.url}` : ''}`,
        ),
      )
    }

    parts.push(
      '',
      'Requirements:',
      '- Include lint, test, and build jobs',
      '- Build and push Docker image',
      '- Deploy to environments based on branch',
      '- Use caching for dependencies',
      '- Include proper permissions',
      '- Add environment protection rules',
      '- Use GitHub Container Registry',
      '',
      'Output ONLY valid GitHub Actions YAML, no explanations or markdown code blocks.',
    )

    return parts.join('\n')
  }

  /**
   * 构建 GitLab CI prompt
   */
  private buildGitLabCIPrompt(options: GitLabCIOptions): string {
    const parts = [
      'Generate a complete GitLab CI/CD pipeline YAML with the following specifications:',
      '',
      `Application: ${options.appName}`,
      `Language: ${options.language}`,
    ]

    if (options.framework) {
      parts.push(`Framework: ${options.framework}`)
    }

    parts.push(
      `Branches: ${options.branches?.join(', ') || 'main, develop'}`,
      `Registry: ${options.registry || '$CI_REGISTRY'}`,
    )

    if (options.buildCommand) {
      parts.push(`Build Command: ${options.buildCommand}`)
    }

    if (options.testCommand) {
      parts.push(`Test Command: ${options.testCommand}`)
    }

    if (options.lintCommand) {
      parts.push(`Lint Command: ${options.lintCommand}`)
    }

    if (options.deployEnvironments && options.deployEnvironments.length > 0) {
      parts.push(
        '',
        'Deploy Environments:',
        ...options.deployEnvironments.map(
          (env) => `- ${env.name} (${env.branch})${env.url ? ` -> ${env.url}` : ''}`,
        ),
      )
    }

    parts.push(
      '',
      'Requirements:',
      '- Define stages: prepare, test, build, deploy',
      '- Include lint, type-check, and unit test jobs',
      '- Build and push Docker image',
      '- Deploy to environments based on branch',
      '- Use caching for dependencies',
      '- Include proper artifacts and cache configuration',
      '- Use GitLab Container Registry',
      '- Add manual approval for production',
      '',
      'Output ONLY valid GitLab CI YAML, no explanations or markdown code blocks.',
    )

    return parts.join('\n')
  }

  /**
   * 使用 AI 生成配置
   */
  private async generateConfig(
    prompt: string,
    configType: string,
    aiConfig?: AIClientConfig,
  ): Promise<string> {
    const systemPrompt = this.getSystemPrompt(configType)

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: prompt,
      },
    ]

    const config = aiConfig || this.getDefaultAIConfig()

    try {
      const result = await this.aiService.complete(config, { messages })
      const extractedConfig = this.extractConfig(result.content)

      this.logger.log(`Generated ${configType} config (${extractedConfig.length} chars)`)
      return extractedConfig
    } catch (error) {
      this.logger.error(`Failed to generate ${configType} config:`, error)
      throw new Error(`Configuration generation failed: ${error}`)
    }
  }

  /**
   * 分析配置并提供优化建议
   */
  private async analyzeConfig(
    config: string,
    configType: string,
    aiConfig?: AIClientConfig,
  ): Promise<OptimizationSuggestion[]> {
    const systemPrompt = `You are a DevOps expert. Analyze configurations and provide optimization suggestions.
Focus on practical improvements in performance, security, cost, and reliability.
Output suggestions as a JSON array.`

    const prompt = `Analyze this ${configType} configuration and provide optimization suggestions:

\`\`\`
${config}
\`\`\`

Provide suggestions in this JSON format:
[
  {
    "category": "performance|security|cost|reliability",
    "severity": "low|medium|high",
    "title": "Short title",
    "description": "What could be improved",
    "recommendation": "How to improve it",
    "example": "Code example (optional)"
  }
]

Output ONLY the JSON array, no explanations.`

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: prompt,
      },
    ]

    const aiConfigToUse = aiConfig || this.getDefaultAIConfig()

    try {
      const result = await this.aiService.complete(aiConfigToUse, { messages })
      const suggestions = this.parseOptimizations(result.content)

      this.logger.log(`Generated ${suggestions.length} optimization suggestions`)
      return suggestions
    } catch (error) {
      this.logger.warn(`Failed to generate optimization suggestions:`, error)
      return []
    }
  }

  /**
   * 获取系统提示词
   */
  private getSystemPrompt(configType: string): string {
    const prompts: Record<string, string> = {
      kubernetes: `You are a Kubernetes expert. Generate production-ready Kubernetes YAML configurations.
Follow best practices for security, reliability, and performance.
Output ONLY valid YAML, no explanations or markdown code blocks.`,

      dockerfile: `You are a Docker expert. Generate optimized, secure Dockerfiles.
Use multi-stage builds, minimize image size, and follow security best practices.
Output ONLY valid Dockerfile content, no explanations or markdown code blocks.`,

      'github-actions': `You are a GitHub Actions expert. Generate complete CI/CD workflows.
Include proper caching, security, and deployment strategies.
Output ONLY valid GitHub Actions YAML, no explanations or markdown code blocks.`,

      'gitlab-ci': `You are a GitLab CI expert. Generate complete CI/CD pipelines.
Include proper stages, caching, and deployment strategies.
Output ONLY valid GitLab CI YAML, no explanations or markdown code blocks.`,
    }

    return (
      prompts[configType] ||
      'You are a DevOps expert. Generate configuration files following best practices.'
    )
  }

  /**
   * 提取配置内容（移除 markdown 代码块）
   */
  private extractConfig(content: string): string {
    // 移除 markdown 代码块
    const codeBlockMatch = content.match(/```(?:\w+)?\n([\s\S]*?)\n```/)
    if (codeBlockMatch?.[1]) {
      return codeBlockMatch[1].trim()
    }

    return content.trim()
  }

  /**
   * 解析优化建议
   */
  private parseOptimizations(content: string): OptimizationSuggestion[] {
    try {
      // 提取 JSON
      const jsonMatch =
        content.match(/```(?:json)?\n([\s\S]*?)\n```/) || content.match(/\[[\s\S]*\]/)
      const jsonStr = jsonMatch?.[1] || jsonMatch?.[0] || content

      const suggestions = JSON.parse(jsonStr)

      if (Array.isArray(suggestions)) {
        return suggestions.filter(this.isValidOptimization)
      }

      return []
    } catch (error) {
      this.logger.warn('Failed to parse optimization suggestions:', error)
      return []
    }
  }

  /**
   * 验证优化建议格式
   */
  private isValidOptimization(suggestion: unknown): suggestion is OptimizationSuggestion {
    if (!suggestion || typeof suggestion !== 'object') return false

    const s = suggestion as Record<string, unknown>
    return (
      ['performance', 'security', 'cost', 'reliability'].includes(s.category as string) &&
      ['low', 'medium', 'high'].includes(s.severity as string) &&
      typeof s.title === 'string' &&
      typeof s.description === 'string' &&
      typeof s.recommendation === 'string'
    )
  }

  /**
   * 获取默认 AI 配置
   */
  private getDefaultAIConfig(): AIClientConfig {
    return {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.3, // 低温度以获得更确定性的输出
      maxTokens: 4000,
    }
  }
}
