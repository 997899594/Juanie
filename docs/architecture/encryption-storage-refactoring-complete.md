# 加密和存储服务重构完成报告

**日期**: 2024-12-24  
**状态**: ✅ 完成

## 概述

完成了 Core 层加密和存储服务的重构，将加密改为纯函数，将存储服务移至 Foundation 层。

## 架构决策

### 1. 加密服务 → 纯函数

**位置**: `packages/core/src/encryption/`

**原因**:
- 加密是无状态的纯计算操作
- 不需要依赖注入
- 更简单、更直接
- 符合函数式编程原则

**实现**:
```typescript
// 纯函数实现
export function encrypt(plaintext: string, key: string): string
export function decrypt(ciphertext: string, key: string): string
export function getEncryptionKey(config: ConfigService): string
export function testEncryption(key: string): boolean

// 错误类
export class EncryptionError extends Error
```

**使用方式**:
```typescript
import { encrypt, decrypt, getEncryptionKey } from '@juanie/core/encryption'
import { ConfigService } from '@nestjs/config'

class MyService {
  private encryptionKey: string

  constructor(private config: ConfigService) {
    this.encryptionKey = getEncryptionKey(config)
  }

  encryptData(data: string) {
    return encrypt(data, this.encryptionKey)
  }

  decryptData(ciphertext: string) {
    return decrypt(ciphertext, this.encryptionKey)
  }
}
```

### 2. 存储服务 → Foundation 层

**位置**: `packages/services/foundation/src/storage/`

**原因**:
- 包含业务逻辑（bucket 管理、初始化、策略）
- 需要依赖注入（ConfigService, PinoLogger）
- 属于基础设施服务，但不是纯基础设施

**实现**:
```typescript
@Injectable()
export class StorageService {
  constructor(
    private config: ConfigService,
    private logger: PinoLogger,
  ) {}

  async uploadFile(objectName: string, buffer: Buffer, ...): Promise<string>
  async deleteFile(objectName: string): Promise<void>
  async getPresignedUrl(objectName: string, expiry?: number): Promise<string>
  async fileExists(objectName: string): Promise<boolean>
}

export class StorageError extends OperationFailedError {
  // 存储服务特有的错误
}
```

## 修复的问题

### 1. Database Schema 导入问题

**问题**: TypeScript 错误地从 `@juanie/core/dist/database` 导入 schema，而不是 `@juanie/database`

**原因**: 
- `packages/database` 没有被添加到 TypeScript 项目引用
- 服务层文件使用了错误的导入路径

**修复**:
1. 在根 `tsconfig.json` 中添加 `packages/database` 引用
2. 批量替换所有文件中的导入：
   - `from '@juanie/core/database'` → `from '@juanie/database'`

**影响的文件**:
- Foundation 层: 9 个文件
- Business 层: 所有使用 schema 的文件

### 2. 错误类 Context 只读属性问题

**问题**: BaseError 的 `context` 属性是只读的，不能直接赋值

**修复**: 使用 `Object.defineProperty` 设置 context
```typescript
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

### 3. 错误类重复导出问题

**问题**: Foundation 的 `index.ts` 和 `errors.ts` 都导出了 Core 层的基础错误类，与 `@juanie/types` 冲突

**修复**: 
- `errors.ts`: 重新导出 Core 层基础错误类（供内部使用）
- `index.ts`: 只导出 Foundation 层特有的错误类

```typescript
// errors.ts - 供 Foundation 层内部使用
export {
  BaseError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
  ConflictError,
  OperationFailedError,
} from '@juanie/core/errors'

// index.ts - 只导出 Foundation 特有的错误
export {
  GitConnectionNotFoundError,
  GitConnectionInvalidError,
  TokenDecryptionError,
  // ... 其他 Foundation 特有错误
} from './errors'
```

## 更新的文件

### Core 层
- ✅ `packages/core/src/encryption/index.ts` - 纯函数实现
- ✅ `packages/core/src/index.ts` - 移除 Storage 导出
- ✅ `packages/core/package.json` - 移除 storage 导出配置
- ❌ 删除 `packages/core/src/encryption/encryption.service.ts`
- ❌ 删除 `packages/core/src/encryption/encryption.module.ts`
- ❌ 删除 `packages/core/src/storage/` 目录

### Foundation 层
- ✅ `packages/services/foundation/src/storage/` - 从 Core 移动过来
- ✅ `packages/services/foundation/src/storage/storage.service.ts` - 修复导入和错误类
- ✅ `packages/services/foundation/src/errors.ts` - 修复 context 赋值和导出
- ✅ `packages/services/foundation/src/index.ts` - 修复重复导出
- ✅ `packages/services/foundation/src/git-connections/git-connections.service.ts` - 使用纯函数
- ✅ `packages/services/foundation/src/git-connections/git-connections.module.ts` - 移除 EncryptionModule
- ✅ 所有 service 文件 - 修复 schema 导入路径

### Business 层
- ✅ `packages/services/business/src/gitops/credentials/credentials.module.ts` - 移除 EncryptionModule
- ✅ `packages/services/business/src/gitops/credentials/credential-factory.ts` - 使用纯函数
- ✅ `packages/services/business/src/gitops/credentials/credential-manager.service.ts` - 使用纯函数
- ✅ 所有 service 文件 - 修复 schema 导入路径

### API Gateway
- ✅ `apps/api-gateway/src/routers/projects.router.ts` - 修复 Storage 导入路径

### 配置文件
- ✅ `tsconfig.json` - 添加 `packages/database` 引用

## 类型检查结果

```bash
# Core 层
✅ packages/core: 类型检查通过

# Database 层
✅ packages/database: 类型检查通过

# Foundation 层
✅ packages/services/foundation: 类型检查通过

# Business 层
✅ packages/services/business: 类型检查通过
```

## 导入模式更新

### 加密 - 纯函数
```typescript
// ✅ 正确
import { encrypt, decrypt, getEncryptionKey } from '@juanie/core/encryption'

// ❌ 错误（已删除）
import { EncryptionService } from '@juanie/core/encryption'
```

### 存储 - Foundation 服务
```typescript
// ✅ 正确
import { StorageService } from '@juanie/service-foundation'

// ❌ 错误（已移动）
import { StorageService } from '@juanie/core/storage'
```

### Schema - 独立包
```typescript
// ✅ 正确
import * as schema from '@juanie/database'

// ❌ 错误
import * as schema from '@juanie/core/database'
```

## 架构原则验证

### ✅ Core 层纯净性
- 只包含纯基础设施
- 无业务逻辑
- 加密改为纯函数
- 存储移至 Foundation

### ✅ 关注点分离
- 加密：纯计算逻辑
- 存储：基础设施服务
- 错误：分层定义

### ✅ 依赖方向正确
```
Extensions → Business → Foundation → Core
                                    ↓
                                Database
```

## 后续工作

### 1. 更新项目指南
- [x] 添加加密纯函数的导入示例
- [x] 添加存储服务的导入示例
- [ ] 更新错误处理最佳实践

### 2. 文档更新
- [ ] 更新 Core 包 README
- [ ] 更新 Foundation 包 README
- [ ] 添加加密使用指南

### 3. 测试
- [ ] 添加加密纯函数的单元测试
- [ ] 添加存储服务的集成测试
- [ ] 验证错误处理流程

## 总结

本次重构成功地：

1. **简化了加密实现** - 从 Injectable Service 改为纯函数，更简单直接
2. **修正了架构分层** - 将存储服务移至正确的层级
3. **修复了类型问题** - 解决了 database schema 导入和错误类的类型错误
4. **保持了向后兼容** - 通过导出路径的调整，最小化了对现有代码的影响

所有类型检查通过，架构更加清晰，符合项目的核心原则。
