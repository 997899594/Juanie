import * as schema from '@juanie/core/database'
import { Trace } from '@juanie/core/observability'
import { DATABASE } from '@juanie/core/tokens'
import type { CreateNotificationInput } from '@juanie/core-types'
import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

@Injectable()
export class NotificationsService {
  constructor(@Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>) {}

  // 创建通知
  @Trace('notifications.create')
  async create(data: CreateNotificationInput) {
    const [notification] = await this.db
      .insert(schema.notifications)
      .values({
        userId: data.userId,
        type: data.type,
        title: data.title,
        content: data.message, // schema 使用 message，数据库使用 content
        priority: data.priority || 'normal',
        status: 'unread',
      })
      .returning()

    // 触发通知投递
    await this.deliverNotification(notification)

    return notification
  }

  // 投递通知
  private async deliverNotification(notification: any) {
    // 获取用户偏好设置
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, notification.userId))
      .limit(1)

    if (!user) {
      return
    }

    // 检查用户通知偏好
    const preferences = user.preferences as any
    if (!preferences) {
      return
    }

    // 应用内通知已经通过数据库记录实现

    // 邮件通知
    if (preferences.notifications?.email) {
      await this.sendEmailNotification(user.email, notification)
    }

    // 在真实场景中，这里还可以：
    // - 发送推送通知
    // - 发送 Slack/Discord 消息
    // - 发送短信
  }

  // 发送邮件通知
  private async sendEmailNotification(email: string, notification: any) {
    // 在真实场景中，这里会使用邮件服务（如 SendGrid, AWS SES）
    // 简化实现：只记录日志
    console.log(`[Email] Sending notification to ${email}:`, {
      title: notification.title,
      content: notification.content,
      priority: notification.priority,
    })

    // 实际实现示例：
    // await emailService.send({
    //   to: email,
    //   subject: notification.title,
    //   html: notification.content,
    // })
  }

  // 列出用户通知
  @Trace('notifications.list')
  async list(userId: string, filters?: { status?: string }) {
    const conditions = [eq(schema.notifications.userId, userId)]

    if (filters?.status) {
      conditions.push(eq(schema.notifications.status, filters.status))
    }

    const notifications = await this.db
      .select()
      .from(schema.notifications)
      .where(and(...conditions))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(50)

    return notifications
  }

  // 标记为已读
  @Trace('notifications.markAsRead')
  async markAsRead(userId: string, notificationId: string) {
    const [notification] = await this.db
      .select()
      .from(schema.notifications)
      .where(
        and(eq(schema.notifications.id, notificationId), eq(schema.notifications.userId, userId)),
      )
      .limit(1)

    if (!notification) {
      throw new Error('通知不存在')
    }

    const [updated] = await this.db
      .update(schema.notifications)
      .set({
        status: 'read',
        readAt: new Date(),
      })
      .where(eq(schema.notifications.id, notificationId))
      .returning()

    return updated
  }

  // 标记所有为已读
  @Trace('notifications.markAllAsRead')
  async markAllAsRead(userId: string) {
    await this.db
      .update(schema.notifications)
      .set({
        status: 'read',
        readAt: new Date(),
      })
      .where(
        and(eq(schema.notifications.userId, userId), eq(schema.notifications.status, 'unread')),
      )

    return { success: true }
  }

  // 删除通知
  @Trace('notifications.delete')
  async delete(userId: string, notificationId: string) {
    const [notification] = await this.db
      .select()
      .from(schema.notifications)
      .where(
        and(eq(schema.notifications.id, notificationId), eq(schema.notifications.userId, userId)),
      )
      .limit(1)

    if (!notification) {
      throw new Error('通知不存在')
    }

    await this.db.delete(schema.notifications).where(eq(schema.notifications.id, notificationId))

    return { success: true }
  }

  // 获取未读数量
  @Trace('notifications.getUnreadCount')
  async getUnreadCount(userId: string) {
    const notifications = await this.db
      .select()
      .from(schema.notifications)
      .where(
        and(eq(schema.notifications.userId, userId), eq(schema.notifications.status, 'unread')),
      )

    return { count: notifications.length }
  }
}
