/**
 * AI 服务类型定义
 * 统一管理所有 AI 相关的类型
 */

// 注意: AIProvider 和 AIMessage 在 schemas.ts 中定义(从 zod schema 推断)
// 这里只定义其他 AI 相关类型

/**
 * AI 提供商类型 (用于非 zod 场景)
 * 注意: 优先使用 schemas.ts 中从 zod 推断的类型
 */
export type AIProvider = 'anthropic' | 'openai' | 'google' | 'zhipu' | 'qwen' | 'ollama'

/**
 * 支持的 AI 模型
 */
export type AIModel =
  // Ollama 本地模型
  | 'qwen2.5-coder:7b' // 通义千问代码模型
  | 'deepseek-coder:6.7b' // DeepSeek 代码模型
  | 'codellama:7b' // Meta CodeLlama
  | 'mistral:7b' // Mistral 通用模型
  | 'llama3.1:8b' // Meta Llama 3.1
  // Claude 3.5 模型（2024年10月最新）
  | 'claude-3-5-sonnet-20241022' // 最强多模态
  | 'claude-3-5-haiku-20241022' // 最快最便宜
  // OpenAI GPT-4o 模型（2024年最新）
  | 'gpt-4o' // 最新多模态
  | 'gpt-4o-mini' // 性价比最高
  | 'gpt-4-turbo' // 旧版本
  | 'gpt-4' // 旧版本
  | 'gpt-3.5-turbo' // 旧版本
  // Google Gemini 模型（2024年12月最新）
  | 'gemini-2.0-flash-exp' // 最新实验版本，免费
  | 'gemini-1.5-pro' // 稳定版本
  | 'gemini-1.5-flash' // 快速版本
  // 智谱 GLM 模型（2025年最新）
  | 'glm-4.6' // 最新旗舰多模态，支持深度思考
  | 'glm-4'
  | 'glm-4-flash'
  | 'glm-4v-plus' // 增强多模态
  | 'glm-4v-flash' // 快速多模态
  | 'glm-4v' // 旧版本
  // 阿里 Qwen 模型（2024年最新）
  | 'qwen2.5'
  | 'qwen2.5-coder'
  | 'qwen2-vl-72b' // 最新多模态
  | 'qwen2-vl-7b' // 性价比多模态
  | 'qwenvl' // 旧版本

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
 * 编程语言类型
 */
export type ProgrammingLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'java'
  | 'go'
  | 'rust'
  | 'cpp'
  | 'csharp'
  | 'php'
  | 'ruby'
  | 'swift'
  | 'kotlin'
  | 'vue'
  | 'react'
  | 'sql'
  | 'html'
  | 'css'
  | 'yaml'
  | 'json'
  | 'markdown'

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
 * 代码审查请求
 */
export interface CodeReviewRequest {
  /** 要审查的代码 */
  code: string
  /** 编程语言 */
  language: ProgrammingLanguage
  /** 文件名（可选） */
  fileName?: string
  /** 审查模式 */
  mode?: 'comprehensive' | 'quick' | 'security-focused'
  /** 使用的模型 */
  model?: AIModel
  /** 上下文信息 */
  context?: {
    /** 项目 ID */
    projectId?: string
    /** 项目类型 */
    projectType?: string
    /** 框架 */
    framework?: string
    /** 相关文件 */
    relatedFiles?: string[]
  }
}

/**
 * 批量代码审查请求
 */
export interface BatchCodeReviewRequest {
  /** 文件列表 */
  files: Array<{
    path: string
    code: string
    language: ProgrammingLanguage
  }>
  /** 审查模式 */
  mode?: 'comprehensive' | 'quick' | 'security-focused'
  /** 使用的模型 */
  model?: AIModel
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
