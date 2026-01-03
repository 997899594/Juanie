import { AppError } from './base'

export class StorageError extends AppError {
  constructor(operation: string, reason: string, retryable = false) {
    super(`Storage operation ${operation} failed: ${reason}`, 'STORAGE_ERROR', 500, retryable, {
      operation,
      reason,
    })
  }

  getUserMessage(): string {
    return `文件存储操作失败: ${this.context?.reason}`
  }
}
