/**
 * 通知业务逻辑类型
 * DB 模型类型从 @juanie/core/database 的 Notification 导出
 * 这里只定义非 DB 的业务类型
 */

export type NotificationStatus = 'read' | 'unread'

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface NotificationFilters {
  status?: NotificationStatus
  priority?: NotificationPriority
  startDate?: Date
  endDate?: Date
}

export interface UnreadCountResult {
  count: number
  byCategory?: Record<string, number>
}
