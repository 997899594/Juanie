# 错误类 Context 处理修复完成

## 问题描述

用户质疑 `Object.defineProperty` 方法设置 readonly `context` 属性的正确性。

## 根本原因

Foundation 层的错误类使用 `Object.defineProperty` 来修改继承自父类的 readonly `context` 属性：

```typescript
// ❌ 错误的做法
export class GitConnectionNotFoundError extends NotFoundError {
  constructor(provider: string, userId?: string) {
    super('GitConnection', provider)
    Object.defineProperty(this, 'context', {
      value: { ...this.context, provider, userId },
      writable: false,
      enumerable: true,
    })
  }
}
```

这种方法虽然能工作，但：
1. 违反了 TypeScript 的类型系统（readonly 属性不应被修改）
2. 代码不够清晰，难以理解
3. 需要额外的运行时操作

## 正确的解决方案

`BaseError` 构造函数已经接受 `context` 参数（第5个参数），应该直接传递完整的 context：

```typescript
// ✅ 正确的做法
export class GitConnectionNotFoundError extends BaseError {
  constructor(provider: string, userId?: string) {
    super(
      `GitConnection ${provider} not found`,
      'GIT_CONNECTION_NOT_FOUND',
      404,
      false,
      { provider, userId }  // 直接传递完整 context
    )
  }

  getUserMessage(): string {
    const providerName = this.context?.provider === 'github' ? 'GitHub' : 'GitLab'
    return `未找到 ${providerName} OAuth 连接。请前往"设置 > 账户连接"页面连接您的 ${providerName} 账户。`
  }
}
```

## 修复内容

### 1. Foundation 层错误类 ✅

**文件**: `packages/services/foundation/src/errors.ts`

**修改**:
- 移除所有 `Object.defineProperty` 调用
- 所有错误类直接继承 `BaseError`，不再继承 `NotFoundError`/`ConflictError`/`ForbiddenError`
- 在构造函数中传递完整的 context 对象
- 移除 `override` 关键字（不再需要）

**修复的错误类**:
- `GitConnectionNotFoundError`
- `OrganizationNotFoundError`
- `OrganizationMemberAlreadyExistsError`
- `NotOrganizationMemberError`
- `CannotRemoveOwnerError`
- `TeamNotFoundError`
- `TeamMemberAlreadyExistsError`
- `TeamMemberNotFoundError`
- `NotTeamMemberError`
- `NotificationNotFoundError`
- `PermissionDeniedError`

### 2. Storage 错误类 ✅

**文件**: `packages/services/foundation/src/storage/storage.service.ts`

**修改**:
- `StorageError` 直接继承 `BaseError`
- 移除 `Object.setPrototypeOf` 调用
- 移除 `override` 关键字

### 3. 其他修复 ✅

- **git-connections.service.ts**: 移除未使用的 `config` 属性
- **organization-events.service.ts**: 修复重复的 `EventEmitter2` 导入，使用 `DomainEvents`
- **organizations.service.ts**: 修复 `ResourceNotFoundError` 使用
- **core/package.json**: 添加 `./events` 导出路径

## 类型检查结果

### Core ✅
```bash
bun tsc --noEmit  # 通过
```

### Foundation ✅
```bash
bun tsc --noEmit  # 通过
```

### Business ⏳
需要修复以下问题：
1. 移除 `DatabaseModule` 导入（应该从 Core 导入）
2. 修复 Business 层错误类的 context 处理
3. 修复所有 `EventEmitter2` 重复导入
4. 使用 `DomainEvents`/`SystemEvents` 常量替代 `EventEmitter2.XXX`
5. 修复 Worker 类型导入（不应使用 `type`）

## 架构原则

### 错误类设计原则

1. **直接继承 BaseError**: 所有业务错误类应该直接继承 `BaseError`，而不是继承 `NotFoundError` 等中间类
2. **完整传递 context**: 在构造函数中一次性传递完整的 context 对象
3. **不修改 readonly 属性**: 绝不使用 `Object.defineProperty` 或其他方式修改 readonly 属性
4. **清晰的错误码**: 每个错误类都应该有自己的错误码（如 `GIT_CONNECTION_NOT_FOUND`）

### 示例模板

```typescript
export class MyCustomError extends BaseError {
  constructor(param1: string, param2?: string) {
    super(
      `Clear error message with ${param1}`,  // message
      'MY_CUSTOM_ERROR',                      // code
      404,                                    // statusCode
      false,                                  // retryable
      { param1, param2 }                      // context
    )
  }

  getUserMessage(): string {
    return `用户友好的错误消息: ${this.context?.param1}`
  }
}
```

## 下一步

1. 修复 Business 层的所有类型错误
2. 更新项目指南中的错误处理示例
3. 运行完整的类型检查确保所有包都通过

## 相关文档

- `packages/core/src/errors/base-errors.ts` - 基础错误类定义
- `packages/services/foundation/src/errors.ts` - Foundation 层错误
- `packages/services/business/src/errors.ts` - Business 层错误（待修复）
- `.kiro/steering/project-guide.md` - 项目指南（需更新）
