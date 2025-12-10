import { BusinessError } from './business-errors'

/**
 * AI 推理失败错误
 */
export class AIInferenceFailedError extends BusinessError {
  constructor(message: string, cause?: Error) {
    super(message, 'AI_INFERENCE_FAILED', 500, true, { cause })
  }

  getUserMessage(): string {
    return 'AI 服务暂时不可用，请稍后重试'
  }
}

/**
 * AI 请求超时错误
 */
export class AITimeoutError extends BusinessError {
  constructor() {
    super('AI request timeout', 'AI_TIMEOUT', 504, true)
  }

  getUserMessage(): string {
    return 'AI 请求超时，请稍后重试'
  }
}

/**
 * 错误工厂
 *
 * 提供统一的错误创建接口
 */
export class ErrorFactory {
  /**
   * AI 相关错误
   */
  static ai = {
    /**
     * AI 推理失败
     */
    inferenceFailed: (message: string, cause?: Error) => new AIInferenceFailedError(message, cause),

    /**
     * AI 请求超时
     */
    timeout: () => new AITimeoutError(),
  }
}
