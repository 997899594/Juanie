/**
 * AI 助手业务逻辑类型
 * DB 模型类型从 @juanie/core/database 的 AiAssistant 导出
 * 这里只定义非 DB 的业务类型
 */

export type ChatRole = 'user' | 'assistant' | 'system'

// ============================================
// 聊天消息
// ============================================

export interface ChatMessage {
  role: ChatRole
  content: string
  timestamp?: Date
  metadata?: Record<string, unknown>
}

export interface ChatRequest {
  assistantId: string
  message: string
  context?: Record<string, unknown>
  history?: ChatMessage[]
}

export interface ChatResponse {
  message: string
  usage?: TokenUsage
  metadata?: Record<string, unknown>
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

// ============================================
// Ollama 相关
// ============================================

export interface OllamaModel {
  name: string
  size: number
  modified: string
  digest?: string
  details?: {
    format: string
    family: string
    families?: string[]
    parameter_size: string
    quantization_level: string
  }
}

export interface OllamaStatus {
  available: boolean
  version?: string
  models?: OllamaModel[]
  error?: string
}
