# @juanie/service-users

用户服务包，提供用户信息管理功能。

## 功能

- 获取当前用户信息
- 更新用户资料（用户名、显示名称、头像）
- 管理用户偏好设置（语言、主题、通知）
- 获取用户公开信息
- 批量查询用户信息

## 使用

```typescript
import { UsersModule, UsersService } from '@juanie/service-users'

// 在模块中导入
@Module({
  imports: [UsersModule],
})
export class AppModule {}

// 使用服务
@Injectable()
export class MyService {
  constructor(private users: UsersService) {}

  async getCurrentUser(userId: string) {
    return await this.users.getMe(userId)
  }

  async updateProfile(userId: string) {
    return await this.users.updateMe(userId, {
      displayName: 'New Name',
      avatarUrl: 'https://example.com/avatar.jpg',
    })
  }

  async updateSettings(userId: string) {
    return await this.users.updatePreferences(userId, {
      theme: 'dark',
      language: 'zh',
      notifications: {
        email: true,
        inApp: true,
      },
    })
  }
}
```

## 依赖

- `@juanie/core-database` - 数据库访问
- `@juanie/core-observability` - 可观测性追踪
