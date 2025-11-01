# @juanie/service-notifications

通知服务包，提供应用内通知管理功能。

## 功能

- 创建通知（支持多种类型和优先级）
- 列出用户通知（支持状态过滤）
- 标记通知为已读
- 批量标记所有通知为已读
- 删除通知
- 获取未读通知数量
- 通知投递（应用内、邮件）

## 通知类型

- 系统通知
- 部署通知
- 项目通知
- 团队通知
- 自定义通知

## 优先级

- `low` - 低优先级
- `normal` - 普通（默认）
- `high` - 高优先级
- `urgent` - 紧急

## 使用

```typescript
import { NotificationsModule, NotificationsService } from '@juanie/service-notifications'

// 在模块中导入
@Module({
  imports: [NotificationsModule],
})
export class AppModule {}

// 使用服务
@Injectable()
export class MyService {
  constructor(private notifications: NotificationsService) {}

  async sendNotification(userId: string) {
    return await this.notifications.create({
      userId,
      type: 'deployment',
      title: '部署成功',
      content: '您的应用已成功部署到生产环境',
      priority: 'high',
      resourceType: 'deployment',
      resourceId: 'deploy-123',
    })
  }

  async getNotifications(userId: string) {
    return await this.notifications.list(userId, { status: 'unread' })
  }

  async markAsRead(userId: string, notificationId: string) {
    return await this.notifications.markAsRead(userId, notificationId)
  }
}
```

## 依赖

- `@juanie/core-database` - 数据库访问
- `@juanie/core-observability` - 可观测性追踪
