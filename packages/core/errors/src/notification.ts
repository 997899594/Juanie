import { AppError } from './base'

export class NotificationNotFoundError extends AppError {
  constructor(notificationId: string) {
    super('Notification not found', 'NOTIFICATION_NOT_FOUND', 404, false, { notificationId })
  }

  getUserMessage(): string {
    return '通知不存在'
  }
}
