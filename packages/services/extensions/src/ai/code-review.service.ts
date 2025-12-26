import type {
  AIModel,
  AIProvider,
  BatchCodeReviewRequest,
  BatchCodeReviewResult,
  CodeReviewRequest,
  CodeReviewResult,
  ProgrammingLanguage,
} from '@juanie/types'
import { CodeReviewCategory, CodeReviewSeverity } from '@juanie/types'
import { Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { AIService } from './ai/ai.service'

/**
 * AI 代码审查服务 (增强版)
 * 使用统一的 AI 客户端接口支持多种模型提供商
 */
@Injectable()
export class CodeReviewService {
  constructor(
    private readonly aiService: AIService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CodeReviewService.name)
  }

  /**
   * 全面代码审查
   * 支持多种 AI 提供商和模型
   */
  async comprehensiveReview(request: CodeReviewRequest): Promise<CodeReviewResult> {
    const startTime = Date.now()

    // 确定使用的提供商和模型
    const { provider, model } = this.selectProviderAndModel(request.model)

    const prompt = this.buildReviewPrompt(request, 'comprehensive')

    // 使用统一的 AI 服务
    const result = await this.aiService.complete(
      {
        provider,
        model,
        temperature: 0.3, // 较低温度，更确定性的输出
        maxTokens: 8192,
      },
      {
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(request.language),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      },
      {
        userId: 'system', // 系统调用
        projectId: request.context?.projectId,
      },
    )

    const reviewResult = this.parseReviewResponse(result.content, model)
    reviewResult.duration = Date.now() - startTime

    this.logger.info(
      `Comprehensive review completed for ${request.fileName || 'code'}: ${reviewResult.score}/100`,
    )

    return reviewResult
  }

  /**
   * 快速代码审查（仅关键问题）
   */
  async quickReview(request: CodeReviewRequest): Promise<CodeReviewResult> {
    const startTime = Date.now()

    const { provider, model } = this.selectProviderAndModel(request.model)

    const prompt = this.buildReviewPrompt(request, 'quick')

    const result = await this.aiService.complete(
      {
        provider,
        model,
        temperature: 0.2,
        maxTokens: 4096,
      },
      {
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(request.language),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      },
      {
        userId: 'system',
        projectId: request.context?.projectId,
      },
    )

    const reviewResult = this.parseReviewResponse(result.content, model)
    reviewResult.duration = Date.now() - startTime

    return reviewResult
  }

  /**
   * 安全聚焦审查
   */
  async securityFocusedReview(request: CodeReviewRequest): Promise<CodeReviewResult> {
    const startTime = Date.now()

    const { provider, model } = this.selectProviderAndModel(request.model)

    const prompt = this.buildReviewPrompt(request, 'security-focused')

    const result = await this.aiService.complete(
      {
        provider,
        model,
        temperature: 0.1, // 极低温度，专注安全问题
        maxTokens: 6144,
      },
      {
        messages: [
          {
            role: 'system',
            content:
              'You are a security expert code reviewer. Focus on finding security vulnerabilities, injection risks, authentication issues, and other security concerns.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      },
      {
        userId: 'system',
        projectId: request.context?.projectId,
      },
    )

    const reviewResult = this.parseReviewResponse(result.content, model)
    reviewResult.duration = Date.now() - startTime

    return reviewResult
  }

  /**
   * 批量代码审查
   */
  async batchReview(request: BatchCodeReviewRequest): Promise<BatchCodeReviewResult> {
    const startTime = Date.now()
    const results: Record<string, CodeReviewResult> = {}

    // 并发审查所有文件
    await Promise.all(
      request.files.map(async (file) => {
        const reviewResult = await this.comprehensiveReview({
          code: file.code,
          language: file.language,
          fileName: file.path,
          mode: request.mode,
          model: request.model,
        })
        results[file.path] = reviewResult
      }),
    )

    // 计算总体统计
    const allResults = Object.values(results)
    const overallStatistics = {
      totalFiles: request.files.length,
      totalIssues: allResults.reduce((sum, r) => sum + r.statistics.totalIssues, 0),
      criticalIssues: allResults.reduce((sum, r) => sum + r.statistics.critical, 0),
      warningIssues: allResults.reduce((sum, r) => sum + r.statistics.warning, 0),
      averageScore: allResults.reduce((sum, r) => sum + r.score, 0) / allResults.length,
    }

    return {
      results,
      overallStatistics,
      totalDuration: Date.now() - startTime,
    }
  }

  /**
   * 构建审查提示词
   */
  private buildReviewPrompt(
    request: CodeReviewRequest,
    mode: 'comprehensive' | 'quick' | 'security-focused',
  ): string {
    const contextInfo = request.context
      ? `\n\nContext:\n- Project Type: ${request.context.projectType || 'Unknown'}\n- Framework: ${request.context.framework || 'Unknown'}`
      : ''

    const modeInstructions = {
      comprehensive: `Perform a comprehensive code review covering:
1. Security vulnerabilities
2. Performance issues
3. Potential bugs
4. Code smells
5. Maintainability
6. Best practices
7. Type safety
8. Documentation`,
      quick: `Perform a quick code review focusing on:
1. Critical bugs
2. Security vulnerabilities
3. Obvious performance issues`,
      'security-focused': `Perform a security-focused code review:
1. SQL/NoSQL injection
2. XSS vulnerabilities
3. Authentication/Authorization issues
4. Sensitive data exposure
5. Insecure dependencies
6. CSRF vulnerabilities`,
    }

    return `Review the following ${request.language} code and provide detailed feedback.

${modeInstructions[mode]}

File: ${request.fileName || 'unknown'}${contextInfo}

Code:
\`\`\`${request.language}
${request.code}
\`\`\`

Provide the review in JSON format:
{
  "score": <number 0-100>,
  "summary": "<overall assessment>",
  "issues": [
    {
      "severity": "critical|warning|info|suggestion",
      "category": "security|performance|bug|code_smell|maintainability|best_practice|style|documentation|accessibility|type_safety",
      "title": "<issue title>",
      "description": "<detailed description>",
      "line": <line number if applicable>,
      "suggestion": "<how to fix>",
      "fixedCode": "<corrected code if applicable>"
    }
  ],
  "strengths": ["<positive aspects>"],
  "improvements": ["<improvement suggestions>"]
}`
  }

  /**
   * 获取系统提示
   */
  private getSystemPrompt(language: ProgrammingLanguage): string {
    const languageSpecific: Record<string, string> = {
      typescript:
        'You are an expert TypeScript code reviewer with deep knowledge of type safety, async patterns, and modern TypeScript best practices.',
      javascript:
        'You are an expert JavaScript code reviewer familiar with ES6+, async/await, and modern JavaScript patterns.',
      python:
        'You are an expert Python code reviewer with knowledge of PEP standards, type hints, and Pythonic patterns.',
      vue: 'You are an expert Vue.js code reviewer familiar with Composition API, reactivity, and Vue best practices.',
      react:
        'You are an expert React code reviewer familiar with hooks, component patterns, and performance optimization.',
    }

    return (
      languageSpecific[language] ||
      'You are an experienced code reviewer with expertise in software engineering best practices, security, and code quality.'
    )
  }

  /**
   * 解析审查响应
   */
  private parseReviewResponse(response: string, model: AIModel): CodeReviewResult {
    try {
      // 尝试提取 JSON（AI 可能返回带 markdown 的响应）
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }

      const parsed = JSON.parse(jsonMatch[0])

      interface RawIssue {
        severity?: string
        category?: string
        title?: string
        description?: string
        line?: number
        endLine?: number
        codeSnippet?: string
        suggestion?: string
        fixedCode?: string
        links?: string[]
      }

      // 规范化数据
      const issues = (parsed.issues || []).map((issue: RawIssue, index: number) => ({
        id: `issue-${index + 1}`,
        severity: this.normalizeSeverity(issue.severity || 'info'),
        category: this.normalizeCategory(issue.category || 'code_smell'),
        title: issue.title || 'Unknown issue',
        description: issue.description || '',
        line: issue.line,
        endLine: issue.endLine,
        codeSnippet: issue.codeSnippet,
        suggestion: issue.suggestion,
        fixedCode: issue.fixedCode,
        links: issue.links || [],
      }))

      interface NormalizedIssue {
        severity: CodeReviewSeverity
      }

      // 计算统计
      const statistics = {
        critical: issues.filter((i: NormalizedIssue) => i.severity === CodeReviewSeverity.CRITICAL)
          .length,
        warning: issues.filter((i: NormalizedIssue) => i.severity === CodeReviewSeverity.WARNING)
          .length,
        info: issues.filter((i: NormalizedIssue) => i.severity === CodeReviewSeverity.INFO).length,
        suggestion: issues.filter(
          (i: NormalizedIssue) => i.severity === CodeReviewSeverity.SUGGESTION,
        ).length,
        totalIssues: issues.length,
      }

      return {
        score: Math.max(0, Math.min(100, parsed.score || 70)),
        summary: parsed.summary || 'Code review completed',
        issues,
        strengths: parsed.strengths || [],
        improvements: parsed.improvements || [],
        statistics,
        duration: 0, // 将由调用方设置
        model,
      }
    } catch (error) {
      this.logger.error('Failed to parse review response:', error)

      // 返回回退结果
      return {
        score: 50,
        summary: 'Failed to parse AI response. Manual review recommended.',
        issues: [
          {
            id: 'parse-error',
            severity: CodeReviewSeverity.WARNING,
            category: CodeReviewCategory.CODE_SMELL,
            title: 'AI Response Parse Error',
            description: `Failed to parse AI response: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        strengths: [],
        improvements: ['Review the code manually'],
        statistics: {
          critical: 0,
          warning: 1,
          info: 0,
          suggestion: 0,
          totalIssues: 1,
        },
        duration: 0,
        model,
      }
    }
  }

  /**
   * 规范化严重级别
   */
  private normalizeSeverity(severity: string): CodeReviewSeverity {
    const normalized = severity.toLowerCase()
    if (normalized.includes('critical')) return CodeReviewSeverity.CRITICAL
    if (normalized.includes('warning')) return CodeReviewSeverity.WARNING
    if (normalized.includes('info')) return CodeReviewSeverity.INFO
    return CodeReviewSeverity.SUGGESTION
  }

  /**
   * 规范化分类
   */
  private normalizeCategory(category: string): CodeReviewCategory {
    const normalized = category.toLowerCase().replace(/[\s-]/g, '_')
    const mapping: Record<string, CodeReviewCategory> = {
      security: CodeReviewCategory.SECURITY,
      performance: CodeReviewCategory.PERFORMANCE,
      bug: CodeReviewCategory.BUG,
      code_smell: CodeReviewCategory.CODE_SMELL,
      maintainability: CodeReviewCategory.MAINTAINABILITY,
      best_practice: CodeReviewCategory.BEST_PRACTICE,
      style: CodeReviewCategory.STYLE,
      documentation: CodeReviewCategory.DOCUMENTATION,
      accessibility: CodeReviewCategory.ACCESSIBILITY,
      type_safety: CodeReviewCategory.TYPE_SAFETY,
    }
    return mapping[normalized] || CodeReviewCategory.CODE_SMELL
  }

  /**
   * 选择提供商和模型
   * 根据模型名称自动选择合适的提供商
   */
  private selectProviderAndModel(model?: AIModel): { provider: AIProvider; model: AIModel } {
    // 如果没有指定模型，使用默认的 Qwen2.5-Coder
    if (!model) {
      return {
        provider: 'qwen',
        model: 'qwen2.5-coder',
      }
    }

    // Claude 模型
    if (model.startsWith('claude-')) {
      return { provider: 'anthropic', model }
    }

    // OpenAI 模型
    if (model.startsWith('gpt-')) {
      return { provider: 'openai', model }
    }

    // 智谱 GLM 模型
    if (model.startsWith('glm-')) {
      return { provider: 'zhipu', model }
    }

    // 阿里 Qwen 模型
    if (model.startsWith('qwen')) {
      return { provider: 'qwen', model }
    }

    // 默认使用 Ollama (本地模型)
    return { provider: 'ollama', model }
  }
}
