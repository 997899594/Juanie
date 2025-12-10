# 内容过滤服务 (Content Filter Service)

## 概述

`ContentFilterService` 提供敏感信息检测、内容过滤和审计日志功能,确保 AI 交互的安全性和合规性。

## 功能

### 1. 敏感信息检测

自动检测以下类型的敏感信息:

- **API 密钥**: `api_key`, `apikey`, `access_token` 等
- **密码**: `password`, `passwd`, `pwd` 等
- **邮箱地址**: 标准邮箱格式
- **手机号码**: 中国手机号格式
- **信用卡号**: 16 位卡号
- **IP 地址**: IPv4 地址
- **私钥**: PEM 格式的私钥

### 2. 过滤规则

支持三种过滤动作:

- **block**: 阻止包含敏感信息的请求
- **mask**: 掩码敏感信息(如 `user@example.com` → `u***r@example.com`)
- **warn**: 仅记录警告,不阻止

### 3. 审计日志

记录所有 AI 交互,包括:

- 用户 ID 和项目 ID
- 操作类型
- 输入和输出内容
- 是否被过滤
- 检测到的敏感信息
- 时间戳

## 使用方法

### 基本用法

```typescript
import { ContentFilterService } from '@juanie/service-extensions'

// 注入服务
constructor(private contentFilter: ContentFilterService) {}

// 过滤消息
async processMessages(messages: AIMessage[]) {
  try {
    const filtered = await this.contentFilter.filterMessages(messages)
    // 使用过滤后的消息
    return filtered
  } catch (error) {
    // 处理阻止的请求
    console.error('Content blocked:', error.message)
    throw error
  }
}
```

### 检测敏感信息

```typescript
const text = 'My API key is sk-1234567890abcdef'
const sensitiveInfo = this.contentFilter.detectSensitiveInfo(text)

console.log(sensitiveInfo)
// [
//   {
//     type: 'api_key',
//     value: 'sk-1234567890abcdef',
//     position: { start: 14, end: 34 }
//   }
// ]
```

### 管理过滤规则

```typescript
// 添加自定义规则
this.contentFilter.addRule({
  id: 'custom-pattern',
  name: 'Block Custom Pattern',
  pattern: /secret[_-]?key/gi,
  action: 'block',
  enabled: true,
})

// 禁用规则
this.contentFilter.toggleRule('email-mask', false)

// 移除规则
this.contentFilter.removeRule('custom-pattern')

// 获取所有规则
const rules = this.contentFilter.getRules()
```

### 审计日志

```typescript
// 记录交互
await this.contentFilter.logInteraction({
  userId: 'user-123',
  projectId: 'project-456',
  action: 'ai_completion',
  input: 'User input text',
  output: 'AI response text',
  filtered: false,
  sensitiveInfo: [],
  timestamp: new Date(),
})

// 检查并告警
const hasAlert = await this.contentFilter.checkAndAlert(
  'Text with sensitive info',
  { userId: 'user-123', projectId: 'project-456' }
)
```

## 默认规则

服务初始化时会自动添加以下默认规则:

| 规则 ID | 名称 | 类型 | 动作 | 状态 |
|---------|------|------|------|------|
| `api-key-block` | Block API Keys | API 密钥 | block | 启用 |
| `password-block` | Block Passwords | 密码 | block | 启用 |
| `private-key-block` | Block Private Keys | 私钥 | block | 启用 |
| `email-mask` | Mask Email Addresses | 邮箱 | mask | 启用 |
| `credit-card-block` | Block Credit Card Numbers | 信用卡 | block | 启用 |

## 掩码规则

不同类型的敏感信息使用不同的掩码方式:

- **邮箱**: `user@example.com` → `u***r@example.com`
- **手机**: `13812345678` → `138****5678`
- **信用卡**: `1234-5678-9012-3456` → `****-****-****-3456`
- **其他**: 替换为 `[REDACTED]`

## 错误处理

当检测到需要阻止的敏感信息时,服务会抛出错误:

```typescript
try {
  await this.contentFilter.filterMessages(messages)
} catch (error) {
  // error.message: "Content contains sensitive information that must be blocked: api_key, password"
}
```

## 集成示例

### 在 AI 服务中使用

```typescript
@Injectable()
export class AIService {
  constructor(
    private contentFilter: ContentFilterService,
    private clientFactory: AIClientFactory,
  ) {}

  async complete(config: AIClientConfig, options: AICompletionOptions, context: any) {
    // 1. 过滤输入
    const filtered = await this.contentFilter.filterMessages(options.messages)

    // 2. 调用 AI
    const client = this.clientFactory.createClient(config)
    const result = await client.complete({ ...options, messages: filtered })

    // 3. 记录审计日志
    await this.contentFilter.logInteraction({
      userId: context.userId,
      projectId: context.projectId,
      action: 'ai_completion',
      input: JSON.stringify(filtered),
      output: result.content,
      filtered: filtered !== options.messages,
      sensitiveInfo: [],
      timestamp: new Date(),
    })

    return result
  }
}
```

## 性能考虑

- 敏感信息检测使用正则表达式,对于大文本可能有性能影响
- 建议对输入文本长度进行限制(如 10KB)
- 审计日志异步写入,不阻塞主流程

## 安全最佳实践

1. **定期审查规则**: 根据实际需求调整过滤规则
2. **监控告警**: 设置告警通知,及时发现安全问题
3. **审计日志保留**: 保留足够长的审计日志用于合规审查
4. **最小权限**: 限制审计日志的访问权限
5. **加密存储**: 审计日志中的敏感信息应加密存储

## 未来改进

- [ ] 支持自定义敏感信息类型
- [ ] 支持机器学习模型检测敏感信息
- [ ] 支持多语言敏感信息检测
- [ ] 审计日志持久化到专门的表
- [ ] 集成告警通知系统
- [ ] 支持审计日志查询和导出

## 相关文档

- [AI 模块架构](../ai/README.md)
- [错误处理指南](../../../../../core/src/errors/error-handling-guide.md)
- [安全最佳实践](../../../../../../docs/guides/security-best-practices.md)
