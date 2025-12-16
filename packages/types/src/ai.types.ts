/**
 * AI 服务类型定义
 * 统一管理所有 AI 相关的类型
 *
 * 类型从 schemas.ts 中的 zod schema 推断，保持单一数据源
 */

import type { z } from 'zod'
import type {
  aiModelSchema,
  aiProviderSchema,
  batchCodeReviewRequestSchema,
  codeReviewModeSchema,
  codeReviewRequestSchema,
  programmingLanguageSchema,
} from './schemas'

/**
 * AI 提供商类型
 */
export type AIProvider = z.infer<typeof aiProviderSchema>

/**
 * 支持的 AI 模型
 */
export type AIModel = z.infer<typeof aiModelSchema>

/**
 * 编程语言类型
 */
export type ProgrammingLanguage = z.infer<typeof programmingLanguageSchema>

/**
 * 代码审查模式
 */
export type CodeReviewMode = z.infer<typeof codeReviewModeSchema>

/**
 * 代码审查请求
 */
export type CodeReviewRequest = z.infer<typeof codeReviewRequestSchema>

/**
 * 批量代码审查请求
 */
export type BatchCodeReviewRequest = z.infer<typeof batchCodeReviewRequestSchema>

/**
 * AI 客户端配置
 */
export interface AIClientConfig {
  provider: AIProvider
  model: AIModel
  apiKey?: string
  baseURL?: string
  temperature?: number
  maxTokens?: number
}

/**
 * AI 消息
 */
export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'function'
  content: string
  name?: string
  functionCall?: {
    name: string
    arguments: string
  }
}

/**
 * AI 完成选项
 */
export interface AICompletionOptions {
  messages: AIMessage[]
  temperature?: number
  maxTokens?: number
  stream?: boolean
  functions?: AIFunction[]
  stopSequences?: string[]
}

/**
 * AI 完成结果
 */
export interface AICompletionResult {
  content: string
  finishReason: 'stop' | 'length' | 'function_call' | 'content_filter'
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  functionCall?: {
    name: string
    arguments: Record<string, unknown>
  }
}

/**
 * AI 函数定义
 */
export interface AIFunction {
  name: string
  description: string
  parameters: Record<string, unknown> // JSON Schema
}

/**
 * 代码审查严重级别
 */
export enum CodeReviewSeverity {
  CRITICAL = 'critical', // 严重问题（必须修复）
  WARNING = 'warning', // 警告（建议修复）
  INFO = 'info', // 信息（可优化）
  SUGGESTION = 'suggestion', // 建议（可选）
}

/**
 * 代码审查问题分类
 */
export enum CodeReviewCategory {
  SECURITY = 'security', // 安全问题
  PERFORMANCE = 'performance', // 性能问题
  BUG = 'bug', // 潜在 Bug
  CODE_SMELL = 'code_smell', // 代码异味
  MAINTAINABILITY = 'maintainability', // 可维护性
  BEST_PRACTICE = 'best_practice', // 最佳实践
  STYLE = 'style', // 代码风格
  DOCUMENTATION = 'documentation', // 文档问题
  ACCESSIBILITY = 'accessibility', // 可访问性
  TYPE_SAFETY = 'type_safety', // 类型安全
}

/**
 * 代码审查问题
 */
export interface CodeReviewIssue {
  /** 问题 ID */
  id: string
  /** 严重级别 */
  severity: CodeReviewSeverity
  /** 问题分类 */
  category: CodeReviewCategory
  /** 问题标题 */
  title: string
  /** 详细描述 */
  description: string
  /** 问题所在行号 */
  line?: number
  /** 结束行号 */
  endLine?: number
  /** 问题代码片段 */
  codeSnippet?: string
  /** 修复建议 */
  suggestion?: string
  /** 修复后的代码示例 */
  fixedCode?: string
  /** 相关资源链接 */
  links?: string[]
}

/**
 * 代码审查结果
 */
export interface CodeReviewResult {
  /** 总体评分 (0-100) */
  score: number
  /** 总体评价 */
  summary: string
  /** 发现的问题列表 */
  issues: CodeReviewIssue[]
  /** 优点列表 */
  strengths: string[]
  /** 改进建议 */
  improvements: string[]
  /** 统计信息 */
  statistics: {
    critical: number
    warning: number
    info: number
    suggestion: number
    totalIssues: number
  }
  /** 审查耗时（毫秒） */
  duration: number
  /** 使用的模型 */
  model: AIModel
}

/**
 * 批量代码审查结果
 */
export interface BatchCodeReviewResult {
  /** 文件审查结果映射 */
  results: Record<string, CodeReviewResult>
  /** 总体统计 */
  overallStatistics: {
    totalFiles: number
    totalIssues: number
    criticalIssues: number
    warningIssues: number
    averageScore: number
  }
  /** 总耗时（毫秒） */
  totalDuration: number
}

/**
 * AI 聊天消息
 */
export interface AIChatMessage {
  /** 消息 ID */
  id: string
  /** 角色 */
  role: 'user' | 'assistant' | 'system'
  /** 消息内容 */
  content: string
  /** 时间戳 */
  timestamp: Date
  /** 元数据 */
  metadata?: {
    model?: AIModel
    tokens?: number
    duration?: number
  }
}

/**
 * AI 聊天会话
 */
export interface AIChatSession {
  /** 会话 ID */
  id: string
  /** 消息列表 */
  messages: AIChatMessage[]
  /** 会话标题 */
  title?: string
  /** 创建时间 */
  createdAt: Date
  /** 更新时间 */
  updatedAt: Date
}

/**
 * Ollama 模型信息
 */
export interface OllamaModelInfo {
  /** 模型名称 */
  name: string
  /** 模型大小 */
  size: number
  /** 修改时间 */
  modifiedAt: string
  /** 模型详情 */
  details?: {
    format?: string
    family?: string
    families?: string[]
    parameterSize?: string
    quantizationLevel?: string
  }
}

/**
 * Ollama 生成请求
 */
export interface OllamaGenerateRequest {
  /** 模型名称 */
  model: string
  /** 提示词 */
  prompt: string
  /** 系统提示 */
  system?: string
  /** 温度参数 (0-1) */
  temperature?: number
  /** 最大 token 数 */
  maxTokens?: number
  /** 是否流式输出 */
  stream?: boolean
}

/**
 * Ollama 生成响应
 */
export interface OllamaGenerateResponse {
  /** 模型名称 */
  model: string
  /** 生成的文本 */
  response: string
  /** 是否完成 */
  done: boolean
  /** 上下文 */
  context?: number[]
  /** 总耗时（纳秒） */
  totalDuration?: number
  /** 加载耗时 */
  loadDuration?: number
  /** 提示词评估次数 */
  promptEvalCount?: number
  /** 提示词评估耗时 */
  promptEvalDuration?: number
  /** 评估次数 */
  evalCount?: number
  /** 评估耗时 */
  evalDuration?: number
}
