# @juanie/service-auth

认证服务 - 处理用户认证、OAuth 登录和会话管理。

## 功能

- 用户注册和登录
- OAuth 认证（GitHub、Google）
- 会话管理
- 密码重置

## 使用

```typescript
import { AuthModule } from '@juanie/service-auth/module'
import { authRouter } from '@juanie/service-auth/router'

// 在 NestJS 中使用
@Module({
  imports: [AuthModule],
})
export class AppModule {}

// 在 tRPC 中使用
const appRouter = router({
  auth: authRouter,
})
```

## 开发

```bash
# 构建
bun run build

# 开发模式
bun run dev

# 测试
bun run test
```
