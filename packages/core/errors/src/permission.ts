import { AppError } from './base'

export class PermissionDeniedError extends AppError {
  constructor(resource: string, action: string) {
    super(`Permission denied: ${action} on ${resource}`, 'PERMISSION_DENIED', 403, false, {
      resource,
      action,
    })
  }

  getUserMessage(): string {
    return '您没有权限执行此操作'
  }
}
