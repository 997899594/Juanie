import { Logger } from '@juanie/core/logger'
import type { AIClientConfig, AIMessage } from '@juanie/types'
import { Injectable } from '@nestjs/common'
import { AIService } from '../ai/ai.service'

/**
 * 日志分析选项
 */
export interface LogAnalysisOptions {
  logs: string[]
  context?: {
    service?: string
    environment?: string
    timeRange?: {
      start: Date
      end: Date
    }
  }
}

/**
 * Kubernetes 事件分析选项
 */
export interface K8sEventAnalysisOptions {
  events: Array<{
    type: string
    reason: string
    message: string
    timestamp: Date
    involvedObject?: {
      kind: string
      name: string
      namespace?: string
    }
  }>
  context?: {
    namespace?: string
    resource?: string
  }
}

/**
 * 根因分析结果
 */
export interface RootCauseAnalysis {
  summary: string
  rootCause: string
  contributingFactors: string[]
  affectedComponents: string[]
  severity: 'low' | 'medium' | 'high' | 'critical'
}

/**
 * 修复步骤
 */
export interface FixStep {
  step: number
  title: string
  description: string
  command?: string
  verification?: string
  estimatedTime?: string
}

/**
 * 修复指南
 */
export interface FixGuide {
  title: string
  overview: string
  prerequisites: string[]
  steps: FixStep[]
  rollbackPlan?: string
  preventionMeasures: string[]
}

/**
 * 修复时间估算
 */
export interface TimeEstimate {
  minimum: number // minutes
  maximum: number // minutes
  average: number // minutes
  confidence: 'low' | 'medium' | 'high'
  factors: string[]
}

/**
 * 故障诊断结果
 */
export interface TroubleshootingResult {
  rootCause: RootCauseAnalysis
  fixGuide: FixGuide
  timeEstimate: TimeEstimate
  relatedIssues?: string[]
  references?: string[]
}

/**
 * 故障诊断服务
 * 使用 AI 分析日志、事件，提供根因分析和修复指南
 */
@Injectable()
export class TroubleshootingService {

  constructor(
    private readonly aiService: AIService,
    private readonly logger: Logger,
  ) {
    this.logger.setContext(TroubleshootingService.name)}

  /**
   * 分析应用日志
   */
  async analyzeLogs(
    options: LogAnalysisOptions,
    aiConfig?: AIClientConfig,
  ): Promise<TroubleshootingResult> {
    this.logger.info(`Analyzing ${options.logs.length} log entries`)

    const prompt = this.buildLogAnalysisPrompt(options)
    const result = await this.performAnalysis(prompt, 'log-analysis', aiConfig)

    return result
  }

  /**
   * 分析 Kubernetes 事件
   */
  async analyzeK8sEvents(
    options: K8sEventAnalysisOptions,
    aiConfig?: AIClientConfig,
  ): Promise<TroubleshootingResult> {
    this.logger.info(`Analyzing ${options.events.length} Kubernetes events`)

    const prompt = this.buildK8sEventAnalysisPrompt(options)
    const result = await this.performAnalysis(prompt, 'k8s-events', aiConfig)

    return result
  }

  /**
   * 综合诊断（日志 + K8s 事件）
   */
  async comprehensiveDiagnosis(
    logOptions: LogAnalysisOptions,
    k8sOptions: K8sEventAnalysisOptions,
    aiConfig?: AIClientConfig,
  ): Promise<TroubleshootingResult> {
    this.logger.info('Performing comprehensive diagnosis')

    const prompt = this.buildComprehensiveDiagnosisPrompt(logOptions, k8sOptions)
    const result = await this.performAnalysis(prompt, 'comprehensive', aiConfig)

    return result
  }

  /**
   * 构建日志分析 prompt
   */
  private buildLogAnalysisPrompt(options: LogAnalysisOptions): string {
    const parts = [
      'Analyze the following application logs to identify issues and provide troubleshooting guidance:',
      '',
    ]

    if (options.context) {
      parts.push('Context:')
      if (options.context.service) {
        parts.push(`- Service: ${options.context.service}`)
      }
      if (options.context.environment) {
        parts.push(`- Environment: ${options.context.environment}`)
      }
      if (options.context.timeRange) {
        parts.push(
          `- Time Range: ${options.context.timeRange.start.toISOString()} to ${options.context.timeRange.end.toISOString()}`,
        )
      }
      parts.push('')
    }

    parts.push('Logs:')
    parts.push('```')
    parts.push(...options.logs.slice(0, 100)) // Limit to 100 lines
    if (options.logs.length > 100) {
      parts.push(`... (${options.logs.length - 100} more lines)`)
    }
    parts.push('```')

    return parts.join('\n')
  }

  /**
   * 构建 K8s 事件分析 prompt
   */
  private buildK8sEventAnalysisPrompt(options: K8sEventAnalysisOptions): string {
    const parts = [
      'Analyze the following Kubernetes events to identify issues and provide troubleshooting guidance:',
      '',
    ]

    if (options.context) {
      parts.push('Context:')
      if (options.context.namespace) {
        parts.push(`- Namespace: ${options.context.namespace}`)
      }
      if (options.context.resource) {
        parts.push(`- Resource: ${options.context.resource}`)
      }
      parts.push('')
    }

    parts.push('Events:')
    for (const event of options.events.slice(0, 50)) {
      // Limit to 50 events
      parts.push(
        `[${event.timestamp.toISOString()}] ${event.type} - ${event.reason}: ${event.message}`,
      )
      if (event.involvedObject) {
        parts.push(
          `  Object: ${event.involvedObject.kind}/${event.involvedObject.name}${event.involvedObject.namespace ? ` (${event.involvedObject.namespace})` : ''}`,
        )
      }
    }

    if (options.events.length > 50) {
      parts.push(`... (${options.events.length - 50} more events)`)
    }

    return parts.join('\n')
  }

  /**
   * 构建综合诊断 prompt
   */
  private buildComprehensiveDiagnosisPrompt(
    logOptions: LogAnalysisOptions,
    k8sOptions: K8sEventAnalysisOptions,
  ): string {
    const parts = [
      'Perform a comprehensive diagnosis by analyzing both application logs and Kubernetes events:',
      '',
      '=== APPLICATION LOGS ===',
      '',
    ]

    parts.push(...this.buildLogAnalysisPrompt(logOptions).split('\n').slice(1))

    parts.push('', '=== KUBERNETES EVENTS ===', '')

    parts.push(...this.buildK8sEventAnalysisPrompt(k8sOptions).split('\n').slice(1))

    return parts.join('\n')
  }

  /**
   * 执行分析
   */
  private async performAnalysis(
    prompt: string,
    analysisType: string,
    aiConfig?: AIClientConfig,
  ): Promise<TroubleshootingResult> {
    const systemPrompt = this.getSystemPrompt()

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
      const troubleshootingResult = this.parseAnalysisResult(result.content)

      this.logger.info(
        `Completed ${analysisType} analysis: ${troubleshootingResult.rootCause.severity} severity`,
      )
      return troubleshootingResult
    } catch (error) {
      this.logger.error(`Failed to perform ${analysisType} analysis:`, error)
      throw new Error(`Troubleshooting analysis failed: ${error}`)
    }
  }

  /**
   * 获取系统提示词
   */
  private getSystemPrompt(): string {
    return `You are an expert DevOps engineer and SRE specializing in troubleshooting production issues.
Your task is to analyze logs and events, identify root causes, and provide actionable fix guides.

When analyzing issues:
1. Identify the root cause, not just symptoms
2. Consider contributing factors and affected components
3. Assess severity accurately (low/medium/high/critical)
4. Provide step-by-step fix guides with commands
5. Estimate realistic fix times
6. Include prevention measures

Output your analysis in the following JSON format:
{
  "rootCause": {
    "summary": "Brief summary of the issue",
    "rootCause": "The fundamental cause of the problem",
    "contributingFactors": ["Factor 1", "Factor 2"],
    "affectedComponents": ["Component 1", "Component 2"],
    "severity": "low|medium|high|critical"
  },
  "fixGuide": {
    "title": "How to Fix [Issue]",
    "overview": "Brief overview of the fix approach",
    "prerequisites": ["Prerequisite 1", "Prerequisite 2"],
    "steps": [
      {
        "step": 1,
        "title": "Step title",
        "description": "Detailed description",
        "command": "kubectl get pods (optional)",
        "verification": "How to verify this step worked (optional)",
        "estimatedTime": "5 minutes (optional)"
      }
    ],
    "rollbackPlan": "How to rollback if fix fails (optional)",
    "preventionMeasures": ["Prevention 1", "Prevention 2"]
  },
  "timeEstimate": {
    "minimum": 15,
    "maximum": 60,
    "average": 30,
    "confidence": "low|medium|high",
    "factors": ["Factor affecting time 1", "Factor 2"]
  },
  "relatedIssues": ["Related issue 1", "Related issue 2"],
  "references": ["https://docs.example.com/troubleshooting"]
}

Output ONLY the JSON object, no explanations or markdown code blocks.`
  }

  /**
   * 解析分析结果
   */
  private parseAnalysisResult(content: string): TroubleshootingResult {
    try {
      // 提取 JSON
      const jsonMatch =
        content.match(/```(?:json)?\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/)
      const jsonStr = jsonMatch?.[1] || jsonMatch?.[0] || content

      const result = JSON.parse(jsonStr)

      // 验证必需字段
      if (!result.rootCause || !result.fixGuide || !result.timeEstimate) {
        throw new Error('Missing required fields in analysis result')
      }

      // 验证 rootCause
      if (!result.rootCause.summary || !result.rootCause.rootCause || !result.rootCause.severity) {
        throw new Error('Invalid rootCause structure')
      }

      // 验证 fixGuide
      if (!result.fixGuide.title || !result.fixGuide.overview || !result.fixGuide.steps) {
        throw new Error('Invalid fixGuide structure')
      }

      // 验证 steps 是数组且有序
      if (!Array.isArray(result.fixGuide.steps) || result.fixGuide.steps.length === 0) {
        throw new Error('fixGuide.steps must be a non-empty array')
      }

      // 验证每个 step 有 step number
      for (const step of result.fixGuide.steps) {
        if (typeof step.step !== 'number' || !step.title || !step.description) {
          throw new Error('Invalid step structure')
        }
      }

      // 验证 timeEstimate
      if (
        typeof result.timeEstimate.minimum !== 'number' ||
        typeof result.timeEstimate.maximum !== 'number' ||
        typeof result.timeEstimate.average !== 'number'
      ) {
        throw new Error('Invalid timeEstimate structure')
      }

      return result as TroubleshootingResult
    } catch (error) {
      this.logger.error('Failed to parse analysis result:', error)
      throw new Error(`Failed to parse troubleshooting result: ${error}`)
    }
  }

  /**
   * 获取默认 AI 配置
   */
  private getDefaultAIConfig(): AIClientConfig {
    return {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.3, // 低温度以获得更准确的分析
      maxTokens: 4000,
    }
  }
}
